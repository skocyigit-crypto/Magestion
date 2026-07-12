import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, tachesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const tachesRouter = Router();
tachesRouter.use(requireModuleAccess("taches"));

const PRIORITE_ENUM = z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]);
const STATUT_ENUM = z.enum(["A_FAIRE", "EN_COURS", "TERMINEE", "ANNULEE"]);

const tacheInputSchema = z.object({
  titre: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  priorite: PRIORITE_ENUM.optional(),
  projectId: z.string().uuid().optional(),
  assigneId: z.string().uuid().optional(),
  echeance: z.string().optional(),
});

tachesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(tachesTable)
    .where(and(eq(tachesTable.licenceId, licenceId), eq(tachesTable.active, !onlyInactive)));

  res.json(rows);
});

tachesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = tacheInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(tachesTable)
    .values({
      licenceId,
      titre: parsed.data.titre,
      description: parsed.data.description,
      priorite: parsed.data.priorite,
      projectId: parsed.data.projectId,
      assigneId: parsed.data.assigneId,
      echeance: parsed.data.echeance,
    })
    .returning();

  res.status(201).json(created);
});

const tacheUpdateSchema = tacheInputSchema.partial().extend({
  statut: STATUT_ENUM.optional(),
  active: z.boolean().optional(),
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
tachesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = tacheUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(tachesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(tachesTable.id, req.params.id), eq(tachesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Tache introuvable" });
    return;
  }
  res.json(updated);
});
