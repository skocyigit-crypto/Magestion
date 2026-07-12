import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, journalEntriesTable, declarationsTvaTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const declarationsTvaRouter = Router();
declarationsTvaRouter.use(requireModuleAccess("comptabilite"));

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// TVA collectee nette = credit - debit sur 44571 (le debit vient des avoirs,
// qui annulent de la TVA deja collectee). TVA deductible nette = debit -
// credit sur 44566. Couvre naturellement l'autoliquidation (qui mouvemente
// les deux comptes du meme montant, sans effet net sur le solde a payer,
// mais visible dans les deux totaux — conforme a la declaration CA3).
async function computeTva(licenceId: string, periodeDebut: string, periodeFin: string) {
  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.licenceId, licenceId),
      gte(journalEntriesTable.ecritureDate, periodeDebut),
      lte(journalEntriesTable.ecritureDate, periodeFin),
    ));

  const collectee44571 = rows.filter((r) => r.compteNum === "44571");
  const tvaCollectee = round2(collectee44571.reduce((s, r) => s + Number(r.credit) - Number(r.debit), 0));

  const deductible44566 = rows.filter((r) => r.compteNum === "44566");
  const tvaDeductible = round2(deductible44566.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0));

  const tvaAPayer = round2(tvaCollectee - tvaDeductible);
  return { tvaCollectee, tvaDeductible, tvaAPayer };
}

const periodeSchema = z.object({ periodeDebut: z.string(), periodeFin: z.string() });

// Previsualisation live — ne sauvegarde rien, permet d'ajuster la periode
// avant de creer la declaration.
declarationsTvaRouter.post("/calculer", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = periodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const result = await computeTva(licenceId, parsed.data.periodeDebut, parsed.data.periodeFin);
  res.json(result);
});

declarationsTvaRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(declarationsTvaTable).where(and(eq(declarationsTvaTable.licenceId, licenceId), eq(declarationsTvaTable.active, true)));
  res.json(rows.sort((a, b) => b.periodeDebut.localeCompare(a.periodeDebut)));
});

declarationsTvaRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = periodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const result = await computeTva(licenceId, parsed.data.periodeDebut, parsed.data.periodeFin);
  const [created] = await db
    .insert(declarationsTvaTable)
    .values({
      licenceId,
      periodeDebut: parsed.data.periodeDebut,
      periodeFin: parsed.data.periodeFin,
      tvaCollectee: result.tvaCollectee.toString(),
      tvaDeductible: result.tvaDeductible.toString(),
      tvaAPayer: result.tvaAPayer.toString(),
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
declarationsTvaRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(declarationsTvaTable)
    .set({ active: parsed.data.active })
    .where(and(eq(declarationsTvaTable.id, req.params.id), eq(declarationsTvaTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Declaration introuvable" });
    return;
  }
  res.json(updated);
});

// Verrouillage definitif (comme les factures/situations) — le montant fige
// ne bouge plus meme si des ecritures sont ajoutees ensuite sur la periode.
declarationsTvaRouter.post("/:id/valider", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [declaration] = await db
    .select()
    .from(declarationsTvaTable)
    .where(and(eq(declarationsTvaTable.id, req.params.id), eq(declarationsTvaTable.licenceId, licenceId)))
    .limit(1);
  if (!declaration) {
    res.status(404).json({ error: "Declaration introuvable" });
    return;
  }
  if (declaration.statut !== "BROUILLON") {
    res.status(409).json({ error: "Declaration deja validee" });
    return;
  }

  const [updated] = await db
    .update(declarationsTvaTable)
    .set({ statut: "VALIDEE", dateValidation: new Date() })
    .where(and(eq(declarationsTvaTable.id, req.params.id), eq(declarationsTvaTable.licenceId, licenceId)))
    .returning();
  res.json(updated);
});
