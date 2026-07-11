import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, situationsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { computeSituationMontants } from "../lib/situationCalc.js";

export const situationsRouter = Router();

function withMontants(row: typeof situationsTable.$inferSelect, cumulPrecedentHt: number) {
  const montants = computeSituationMontants({
    marcheHt: Number(row.marcheHt),
    avancementPercent: Number(row.avancementPercent),
    tauxTva: Number(row.tauxTva),
    tauxRetenueGarantie: Number(row.tauxRetenueGarantie),
    cumulPrecedentHt,
  });
  return { ...row, ...montants };
}

async function loadPrevious(projectId: string, beforeNumero: number) {
  const rows = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.projectId, projectId), eq(situationsTable.active, true)))
    .orderBy(desc(situationsTable.numeroSituation));
  return rows.find((r) => r.numeroSituation < beforeNumero) ?? null;
}

// GET /situations?projectId=xxx (requis) — liste ordonnee, avec montants calcules
situationsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const projectId = req.query.projectId;
  if (typeof projectId !== "string") {
    res.status(400).json({ error: "projectId requis" });
    return;
  }

  const rows = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.licenceId, licenceId), eq(situationsTable.projectId, projectId), eq(situationsTable.active, true)))
    .orderBy(situationsTable.numeroSituation);

  let cumulPrecedent = 0;
  const withCalc = rows.map((row) => {
    const enriched = withMontants(row, cumulPrecedent);
    cumulPrecedent = enriched.montantCumulHt;
    return enriched;
  });

  res.json(withCalc);
});

const situationInputSchema = z.object({
  projectId: z.string().uuid(),
  marcheHt: z.number().nonnegative(),
  avancementPercent: z.number().min(0).max(100),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  tauxRetenueGarantie: z.number().min(0).max(10).optional(),
});

situationsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = situationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existing = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.projectId, parsed.data.projectId), eq(situationsTable.licenceId, licenceId), eq(situationsTable.active, true)))
    .orderBy(desc(situationsTable.numeroSituation));

  const last = existing[0] ?? null;
  const numeroSituation = (last?.numeroSituation ?? 0) + 1;

  // Garde-fou : avancement doit etre croissant (jamais revenir en arriere).
  if (last && parsed.data.avancementPercent < Number(last.avancementPercent)) {
    res.status(409).json({
      error: `Avancement (${parsed.data.avancementPercent}%) inferieur a la situation precedente (${last.avancementPercent}%) — non autorise`,
    });
    return;
  }

  const [created] = await db
    .insert(situationsTable)
    .values({
      licenceId,
      projectId: parsed.data.projectId,
      numeroSituation,
      marcheHt: parsed.data.marcheHt.toString(),
      avancementPercent: parsed.data.avancementPercent.toString(),
      tauxTva: parsed.data.tauxTva?.toString(),
      tauxRetenueGarantie: parsed.data.tauxRetenueGarantie?.toString(),
    })
    .returning();

  const cumulPrecedentHt = last ? Number(last.marcheHt) * (Number(last.avancementPercent) / 100) : 0;
  res.status(201).json(withMontants(created, cumulPrecedentHt));
});

situationsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [situation] = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.id, req.params.id), eq(situationsTable.licenceId, licenceId)))
    .limit(1);
  if (!situation) {
    res.status(404).json({ error: "Situation introuvable" });
    return;
  }

  const previous = await loadPrevious(situation.projectId, situation.numeroSituation);
  const cumulPrecedentHt = previous ? Number(previous.marcheHt) * (Number(previous.avancementPercent) / 100) : 0;
  res.json(withMontants(situation, cumulPrecedentHt));
});

// Validation = verrouillage definitif (regle produit, comme les factures) :
// au-dela de BROUILLON, plus aucune modification possible (pas de route pour ca).
situationsRouter.post("/:id/valider", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [situation] = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.id, req.params.id), eq(situationsTable.licenceId, licenceId)))
    .limit(1);
  if (!situation) {
    res.status(404).json({ error: "Situation introuvable" });
    return;
  }
  if (situation.statut !== "BROUILLON") {
    res.status(409).json({ error: "Situation deja validee" });
    return;
  }

  const [updated] = await db
    .update(situationsTable)
    .set({ statut: "VALIDEE", updatedAt: new Date() })
    .where(and(eq(situationsTable.id, req.params.id), eq(situationsTable.licenceId, licenceId)))
    .returning();

  const previous = await loadPrevious(updated.projectId, updated.numeroSituation);
  const cumulPrecedentHt = previous ? Number(previous.marcheHt) * (Number(previous.avancementPercent) / 100) : 0;
  res.json(withMontants(updated, cumulPrecedentHt));
});
