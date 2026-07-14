import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, sousChantiersTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const sousChantiersRouter = Router();
sousChantiersRouter.use(requireModuleAccess("chantiers"));

const sousChantierInputSchema = z.object({
  projectId: z.string().uuid(),
  nom: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  budgetEstimeHt: z.number().nonnegative().optional(),
});

const sousChantierUpdateSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  budgetEstimeHt: z.number().nonnegative().optional(),
  avancementPercent: z.number().min(0).max(100).optional(),
  statut: z.enum(["EN_ATTENTE", "EN_COURS", "TERMINE", "SUSPENDU"]).optional(),
  active: z.boolean().optional(),
});

sousChantiersRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const projectId = req.query.projectId;
  if (typeof projectId !== "string") {
    res.status(400).json({ error: "projectId requis en query" });
    return;
  }

  const rows = await db
    .select()
    .from(sousChantiersTable)
    .where(and(eq(sousChantiersTable.licenceId, licenceId), eq(sousChantiersTable.projectId, projectId), eq(sousChantiersTable.active, true)));
  res.json(rows);
});

sousChantiersRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = sousChantierInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { budgetEstimeHt, ...rest } = parsed.data;
  const [created] = await db
    .insert(sousChantiersTable)
    .values({ licenceId, ...rest, budgetEstimeHt: budgetEstimeHt?.toString() })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
sousChantiersRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = sousChantierUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { budgetEstimeHt, avancementPercent, ...rest } = parsed.data;
  const [updated] = await db
    .update(sousChantiersTable)
    .set({
      ...rest,
      ...(budgetEstimeHt !== undefined ? { budgetEstimeHt: budgetEstimeHt.toString() } : {}),
      ...(avancementPercent !== undefined ? { avancementPercent: avancementPercent.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(sousChantiersTable.id, req.params.id), eq(sousChantiersTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Sous-chantier introuvable" });
    return;
  }
  res.json(updated);
});
