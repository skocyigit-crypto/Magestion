import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const projectsRouter = Router();
projectsRouter.use(requireModuleAccess("chantiers"));

const projectInputSchema = z.object({
  nom: z.string().min(1).max(200),
  client: z.string().min(1).max(200),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  budgetEstimeHt: z.number().nonnegative().max(9999999999.99).optional(),
  objectifMargePercent: z.number().min(0).max(100).optional(),
  categorie: z.enum(["RENOVATION", "CONSTRUCTION_NEUVE", "ISOLATION", "EXTENSION", "AUTRE"]).optional(),
});

const projectUpdateSchema = projectInputSchema.partial().extend({
  statut: z.enum(["EN_ATTENTE", "EN_COURS", "TERMINE", "SUSPENDU"]).optional(),
  active: z.boolean().optional(),
});

// GET /projects?onlyInactive=true -> corbeille (archives), sinon liste active par defaut
projectsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.licenceId, licenceId), eq(projectsTable.active, !onlyInactive)));

  res.json(rows);
});

projectsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = projectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(projectsTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      client: parsed.data.client,
      adresse: parsed.data.adresse,
      codePostal: parsed.data.codePostal,
      budgetEstimeHt: parsed.data.budgetEstimeHt?.toString(),
      objectifMargePercent: parsed.data.objectifMargePercent?.toString(),
      categorie: parsed.data.categorie,
    })
    .returning();

  res.status(201).json(created);
});

projectsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.licenceId, licenceId)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }
  res.json(project);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
projectsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { budgetEstimeHt, objectifMargePercent, ...rest } = parsed.data;
  const [updated] = await db
    .update(projectsTable)
    .set({
      ...rest,
      ...(budgetEstimeHt !== undefined ? { budgetEstimeHt: budgetEstimeHt.toString() } : {}),
      ...(objectifMargePercent !== undefined ? { objectifMargePercent: objectifMargePercent.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }
  res.json(updated);
});
