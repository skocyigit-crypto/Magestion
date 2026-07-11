import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, sousTraitantsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { isValidSiret } from "../lib/siret.js";

export const sousTraitantsRouter = Router();
sousTraitantsRouter.use(requireModuleAccess("sousTraitants"));

const sousTraitantInputSchema = z.object({
  raisonSociale: z.string().min(1).max(200),
  siret: z.string().refine(isValidSiret, { message: "SIRET invalide (14 chiffres + cle de controle)" }),
  specialite: z.string().max(200).optional(),
  contact: z.string().max(200).optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  assuranceDecennaleValidite: z.string().optional(),
  urssafValidite: z.string().optional(),
});

const sousTraitantUpdateSchema = sousTraitantInputSchema.partial().extend({
  active: z.boolean().optional(),
});

sousTraitantsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(sousTraitantsTable)
    .where(and(eq(sousTraitantsTable.licenceId, licenceId), eq(sousTraitantsTable.active, !onlyInactive)));

  res.json(rows);
});

sousTraitantsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = sousTraitantInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(sousTraitantsTable)
    .values({
      licenceId,
      raisonSociale: parsed.data.raisonSociale,
      siret: parsed.data.siret,
      specialite: parsed.data.specialite,
      contact: parsed.data.contact,
      telephone: parsed.data.telephone,
      email: parsed.data.email || undefined,
      assuranceDecennaleValidite: parsed.data.assuranceDecennaleValidite,
      urssafValidite: parsed.data.urssafValidite,
    })
    .returning();

  res.status(201).json(created);
});

sousTraitantsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [row] = await db
    .select()
    .from(sousTraitantsTable)
    .where(and(eq(sousTraitantsTable.id, req.params.id), eq(sousTraitantsTable.licenceId, licenceId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Sous-traitant introuvable" });
    return;
  }
  res.json(row);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
sousTraitantsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = sousTraitantUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(sousTraitantsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(sousTraitantsTable.id, req.params.id), eq(sousTraitantsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Sous-traitant introuvable" });
    return;
  }
  res.json(updated);
});
