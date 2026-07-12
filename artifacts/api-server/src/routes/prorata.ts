import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, chantierSousTraitantsTable, prorataChargesTable, sousTraitantsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const prorataRouter = Router();
prorataRouter.use(requireModuleAccess("prorata"));

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Vue d'ensemble du compte prorata d'un chantier : participants rattaches +
// charges communes + repartition (parts egales entre participants actifs —
// pas de quote-part personnalisee en v1).
prorataRouter.get("/:projectId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const liens = await db
    .select()
    .from(chantierSousTraitantsTable)
    .where(and(eq(chantierSousTraitantsTable.projectId, req.params.projectId), eq(chantierSousTraitantsTable.licenceId, licenceId), eq(chantierSousTraitantsTable.active, true)));

  const sousTraitantIds = liens.map((l) => l.sousTraitantId);
  const participants = sousTraitantIds.length
    ? await db.select().from(sousTraitantsTable).where(and(eq(sousTraitantsTable.licenceId, licenceId)))
    : [];
  const participantsFiltres = participants.filter((p) => sousTraitantIds.includes(p.id));

  const charges = await db
    .select()
    .from(prorataChargesTable)
    .where(and(eq(prorataChargesTable.projectId, req.params.projectId), eq(prorataChargesTable.licenceId, licenceId), eq(prorataChargesTable.active, true)));

  const totalTtc = round2(charges.reduce((s, c) => s + Number(c.montantHt) * (1 + Number(c.tauxTva) / 100), 0));
  const partParParticipant = participantsFiltres.length > 0 ? round2(totalTtc / participantsFiltres.length) : 0;

  res.json({
    participants: participantsFiltres.map((p) => ({ lienId: liens.find((l) => l.sousTraitantId === p.id)!.id, sousTraitantId: p.id, raisonSociale: p.raisonSociale })),
    charges,
    totalTtc,
    partParParticipant,
  });
});

prorataRouter.post("/:projectId/participants", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ sousTraitantId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [sousTraitant] = await db.select().from(sousTraitantsTable).where(and(eq(sousTraitantsTable.id, parsed.data.sousTraitantId), eq(sousTraitantsTable.licenceId, licenceId))).limit(1);
  if (!sousTraitant) {
    res.status(404).json({ error: "Sous-traitant introuvable" });
    return;
  }

  const [existing] = await db
    .select()
    .from(chantierSousTraitantsTable)
    .where(and(eq(chantierSousTraitantsTable.projectId, req.params.projectId), eq(chantierSousTraitantsTable.sousTraitantId, parsed.data.sousTraitantId), eq(chantierSousTraitantsTable.licenceId, licenceId)))
    .limit(1);
  if (existing) {
    const [reactivated] = await db
      .update(chantierSousTraitantsTable)
      .set({ active: true })
      .where(eq(chantierSousTraitantsTable.id, existing.id))
      .returning();
    res.status(existing.active ? 200 : 201).json(reactivated);
    return;
  }

  const [created] = await db
    .insert(chantierSousTraitantsTable)
    .values({ licenceId, projectId: req.params.projectId, sousTraitantId: parsed.data.sousTraitantId })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : retrait du chantier = desactivation du lien (regle produit).
prorataRouter.patch("/participants/:lienId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(chantierSousTraitantsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(chantierSousTraitantsTable.id, req.params.lienId), eq(chantierSousTraitantsTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lien introuvable" });
    return;
  }
  res.json(updated);
});

const chargeInputSchema = z.object({
  libelle: z.string().min(1).max(300),
  montantHt: z.number().nonnegative().max(999999.99),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  dateOperation: z.string(),
});

prorataRouter.post("/:projectId/charges", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = chargeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(prorataChargesTable)
    .values({
      licenceId,
      projectId: req.params.projectId,
      libelle: parsed.data.libelle,
      montantHt: parsed.data.montantHt.toString(),
      tauxTva: (parsed.data.tauxTva ?? 20).toString(),
      dateOperation: parsed.data.dateOperation,
    })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
prorataRouter.patch("/charges/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(prorataChargesTable)
    .set({ active: parsed.data.active })
    .where(and(eq(prorataChargesTable.id, req.params.id), eq(prorataChargesTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Charge introuvable" });
    return;
  }
  res.json(updated);
});
