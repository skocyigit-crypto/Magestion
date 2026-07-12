import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, situationsTable, retenueLiberationsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { computeSituationMontants } from "../lib/situationCalc.js";

export const retenuesGarantieRouter = Router();
retenuesGarantieRouter.use(requireModuleAccess("situations"));

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function totalRetenue(projectId: string, licenceId: string): Promise<number> {
  const situations = await db
    .select()
    .from(situationsTable)
    .where(and(eq(situationsTable.projectId, projectId), eq(situationsTable.licenceId, licenceId), eq(situationsTable.active, true), eq(situationsTable.statut, "VALIDEE")))
    .orderBy(situationsTable.numeroSituation);

  let cumulPrecedent = 0;
  let total = 0;
  for (const s of situations) {
    const montants = computeSituationMontants({
      marcheHt: Number(s.marcheHt),
      avancementPercent: Number(s.avancementPercent),
      tauxTva: Number(s.tauxTva),
      tauxRetenueGarantie: Number(s.tauxRetenueGarantie),
      cumulPrecedentHt: cumulPrecedent,
    });
    total += montants.montantRetenueGarantie;
    cumulPrecedent = montants.montantCumulHt;
  }
  return round2(total);
}

retenuesGarantieRouter.get("/:projectId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const total = await totalRetenue(req.params.projectId, licenceId);
  const liberations = await db
    .select()
    .from(retenueLiberationsTable)
    .where(and(eq(retenueLiberationsTable.projectId, req.params.projectId), eq(retenueLiberationsTable.licenceId, licenceId), eq(retenueLiberationsTable.active, true)));

  const totalLibere = round2(liberations.reduce((s, l) => s + Number(l.montant), 0));

  res.json({
    totalRetenue: total,
    totalLibere,
    resteALiberer: round2(total - totalLibere),
    liberations,
  });
});

const liberationInputSchema = z.object({
  montant: z.number().positive().max(9999999999.99),
  dateLiberation: z.string(),
  notes: z.string().max(2000).optional(),
});

retenuesGarantieRouter.post("/:projectId/liberer", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = liberationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const total = await totalRetenue(req.params.projectId, licenceId);
  const liberations = await db
    .select()
    .from(retenueLiberationsTable)
    .where(and(eq(retenueLiberationsTable.projectId, req.params.projectId), eq(retenueLiberationsTable.licenceId, licenceId), eq(retenueLiberationsTable.active, true)));
  const totalLibere = liberations.reduce((s, l) => s + Number(l.montant), 0);
  const resteALiberer = round2(total - totalLibere);

  if (parsed.data.montant > resteALiberer + 0.01) {
    res.status(409).json({ error: `Montant superieur au reste a liberer (${resteALiberer} €)` });
    return;
  }

  const [created] = await db
    .insert(retenueLiberationsTable)
    .values({
      licenceId,
      projectId: req.params.projectId,
      montant: parsed.data.montant.toString(),
      dateLiberation: parsed.data.dateLiberation,
      notes: parsed.data.notes,
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : annulation d'une liberation enregistree par erreur se fait
// via archivage (regle produit), pas suppression.
retenuesGarantieRouter.patch("/liberations/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(retenueLiberationsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(retenueLiberationsTable.id, req.params.id), eq(retenueLiberationsTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Liberation introuvable" });
    return;
  }
  res.json(updated);
});
