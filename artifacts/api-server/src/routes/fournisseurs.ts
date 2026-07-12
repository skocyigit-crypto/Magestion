import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, fournisseursTable, commandesTable, depensesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const fournisseursRouter = Router();
fournisseursRouter.use(requireModuleAccess("fournisseurs"));

const fournisseurInputSchema = z.object({
  nom: z.string().min(1).max(200),
  email: z.string().email().optional(),
  telephone: z.string().max(30).optional(),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  ville: z.string().max(200).optional(),
  siret: z.string().max(14).optional(),
  tvaIntracommunautaire: z.string().max(30).optional(),
  iban: z.string().max(34).optional(),
  bic: z.string().max(11).optional(),
  conditionsPaiement: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

fournisseursRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(fournisseursTable)
    .where(and(eq(fournisseursTable.licenceId, licenceId), eq(fournisseursTable.active, !onlyInactive)));

  res.json(rows);
});

fournisseursRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = fournisseurInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(fournisseursTable)
    .values({ licenceId, ...parsed.data })
    .returning();

  res.status(201).json(created);
});

fournisseursRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [fournisseur] = await db
    .select()
    .from(fournisseursTable)
    .where(and(eq(fournisseursTable.id, req.params.id), eq(fournisseursTable.licenceId, licenceId)))
    .limit(1);

  if (!fournisseur) {
    res.status(404).json({ error: "Fournisseur introuvable" });
    return;
  }
  res.json(fournisseur);
});

const fournisseurUpdateSchema = fournisseurInputSchema.partial().extend({ active: z.boolean().optional() });

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
fournisseursRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = fournisseurUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(fournisseursTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(fournisseursTable.id, req.params.id), eq(fournisseursTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Fournisseur introuvable" });
    return;
  }
  res.json(updated);
});

// Historique : commandes et depenses rattachees (fournisseurId), avec total
// engage HT — vue d'ensemble du volume d'affaires avec ce fournisseur.
fournisseursRouter.get("/:id/historique", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [fournisseur] = await db
    .select({ id: fournisseursTable.id })
    .from(fournisseursTable)
    .where(and(eq(fournisseursTable.id, req.params.id), eq(fournisseursTable.licenceId, licenceId)))
    .limit(1);
  if (!fournisseur) {
    res.status(404).json({ error: "Fournisseur introuvable" });
    return;
  }

  const commandes = await db
    .select()
    .from(commandesTable)
    .where(and(eq(commandesTable.fournisseurId, req.params.id), eq(commandesTable.licenceId, licenceId), eq(commandesTable.active, true)));

  const depenses = await db
    .select()
    .from(depensesTable)
    .where(and(eq(depensesTable.fournisseurId, req.params.id), eq(depensesTable.licenceId, licenceId), eq(depensesTable.active, true)));

  const totalCommandesHt = commandes.reduce((s, c) => s + Number(c.montantHt), 0);
  const totalDepensesHt = depenses.reduce((s, d) => s + Number(d.montantHt), 0);

  res.json({
    commandes,
    depenses,
    totalCommandesHt,
    totalDepensesHt,
    totalEngageHt: totalCommandesHt + totalDepensesHt,
  });
});
