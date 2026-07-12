import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, locationsMaterielTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const locationsMaterielRouter = Router();
locationsMaterielRouter.use(requireModuleAccess("locationsMateriel"));

const locationInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  designation: z.string().min(1).max(300),
  fournisseur: z.string().min(1).max(200),
  dateDebut: z.string(),
  dateFin: z.string().optional(),
  coutJournalierHt: z.number().nonnegative().max(999999.99),
});

const locationUpdateSchema = locationInputSchema.partial().extend({
  statut: z.enum(["EN_COURS", "TERMINEE"]).optional(),
  active: z.boolean().optional(),
});

locationsMaterielRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(locationsMaterielTable)
    .where(and(eq(locationsMaterielTable.licenceId, licenceId), eq(locationsMaterielTable.active, !onlyInactive)));
  res.json(rows);
});

locationsMaterielRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = locationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(locationsMaterielTable)
    .values({
      licenceId,
      projectId: parsed.data.projectId,
      designation: parsed.data.designation,
      fournisseur: parsed.data.fournisseur,
      dateDebut: parsed.data.dateDebut,
      dateFin: parsed.data.dateFin,
      coutJournalierHt: parsed.data.coutJournalierHt.toString(),
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
locationsMaterielRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = locationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { coutJournalierHt, ...rest } = parsed.data;
  const [updated] = await db
    .update(locationsMaterielTable)
    .set({ ...rest, ...(coutJournalierHt !== undefined ? { coutJournalierHt: coutJournalierHt.toString() } : {}), updatedAt: new Date() })
    .where(and(eq(locationsMaterielTable.id, req.params.id), eq(locationsMaterielTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Location introuvable" });
    return;
  }
  res.json(updated);
});
