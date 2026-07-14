import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, archivesDecennalesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const archivesDecennalesRouter = Router();
archivesDecennalesRouter.use(requireModuleAccess("archivesDecennales"));

const archiveInputSchema = z.object({
  projectId: z.string().uuid(),
  sousTraitantId: z.string().uuid(),
  numeroAttestation: z.string().min(1).max(200),
  assureur: z.string().min(1).max(300),
  activiteCouverte: z.string().max(500).optional(),
  dateDebutValidite: z.string(),
  dateFinValidite: z.string(),
  documentId: z.string().uuid().optional(),
  dateDroc: z.string().optional(),
  notes: z.string().optional(),
});

const archiveUpdateSchema = archiveInputSchema.partial().extend({
  active: z.boolean().optional(),
});

archivesDecennalesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const projectId = req.query.projectId;
  const conditions = [eq(archivesDecennalesTable.licenceId, licenceId)];
  if (typeof projectId === "string") conditions.push(eq(archivesDecennalesTable.projectId, projectId));

  const rows = await db
    .select()
    .from(archivesDecennalesTable)
    .where(and(...conditions));
  res.json(rows);
});

archivesDecennalesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = archiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db.insert(archivesDecennalesTable).values({ licenceId, ...parsed.data }).returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// Bloque aussi toute modification une fois scelle (obligation legale de
// conservation 10 ans, meme logique que le verrouillage WORM des documents).
archivesDecennalesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = archiveUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(archivesDecennalesTable)
    .where(and(eq(archivesDecennalesTable.id, req.params.id), eq(archivesDecennalesTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Archive introuvable" });
    return;
  }
  if (existing.scelle) {
    res.status(423).json({ error: "Archive scellee : conservation legale 10 ans, plus aucune modification possible" });
    return;
  }

  const [updated] = await db
    .update(archivesDecennalesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(archivesDecennalesTable.id, existing.id))
    .returning();
  res.json(updated);
});

archivesDecennalesRouter.post("/:id/sceller", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [existing] = await db
    .select()
    .from(archivesDecennalesTable)
    .where(and(eq(archivesDecennalesTable.id, req.params.id), eq(archivesDecennalesTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Archive introuvable" });
    return;
  }
  if (existing.scelle) {
    res.json(existing);
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(archivesDecennalesTable)
    .set({ scelle: true, dateCloture: now.toISOString().slice(0, 10), updatedAt: now })
    .where(eq(archivesDecennalesTable.id, existing.id))
    .returning();
  res.json(updated);
});
