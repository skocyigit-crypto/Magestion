import { Router } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, chantierPhasesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const chantierPlanningRouter = Router();
chantierPlanningRouter.use(requireModuleAccess("chantierPlanning"));

chantierPlanningRouter.get("/:projectId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(chantierPhasesTable)
    .where(
      and(
        eq(chantierPhasesTable.projectId, req.params.projectId),
        eq(chantierPhasesTable.licenceId, licenceId),
        eq(chantierPhasesTable.active, !onlyInactive),
      ),
    )
    .orderBy(asc(chantierPhasesTable.dateDebut), asc(chantierPhasesTable.ordre));

  res.json(rows);
});

const phaseInputSchema = z
  .object({
    nom: z.string().min(1).max(200),
    dateDebut: z.string(),
    dateFin: z.string(),
    avancementPercent: z.number().min(0).max(100).optional(),
    ordre: z.number().int().optional(),
  })
  .refine((v) => v.dateFin >= v.dateDebut, { message: "La date de fin doit etre posterieure ou egale a la date de debut", path: ["dateFin"] });

chantierPlanningRouter.post("/:projectId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = phaseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(chantierPhasesTable)
    .values({
      licenceId,
      projectId: req.params.projectId,
      nom: parsed.data.nom,
      dateDebut: parsed.data.dateDebut,
      dateFin: parsed.data.dateFin,
      avancementPercent: parsed.data.avancementPercent?.toString(),
      ordre: parsed.data.ordre,
    })
    .returning();

  res.status(201).json(created);
});

const phaseUpdateSchema = z
  .object({
    nom: z.string().min(1).max(200).optional(),
    dateDebut: z.string().optional(),
    dateFin: z.string().optional(),
    avancementPercent: z.number().min(0).max(100).optional(),
    ordre: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => !v.dateDebut || !v.dateFin || v.dateFin >= v.dateDebut, {
    message: "La date de fin doit etre posterieure ou egale a la date de debut",
    path: ["dateFin"],
  });

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
chantierPlanningRouter.patch("/phases/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = phaseUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  if ((parsed.data.dateDebut || parsed.data.dateFin) && !(parsed.data.dateDebut && parsed.data.dateFin)) {
    const [existing] = await db
      .select({ dateDebut: chantierPhasesTable.dateDebut, dateFin: chantierPhasesTable.dateFin })
      .from(chantierPhasesTable)
      .where(and(eq(chantierPhasesTable.id, req.params.id), eq(chantierPhasesTable.licenceId, licenceId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Phase introuvable" });
      return;
    }
    const nextDebut = parsed.data.dateDebut ?? existing.dateDebut;
    const nextFin = parsed.data.dateFin ?? existing.dateFin;
    if (nextFin < nextDebut) {
      res.status(400).json({ error: "La date de fin doit etre posterieure ou egale a la date de debut" });
      return;
    }
  }

  const { avancementPercent, ...rest } = parsed.data;
  const [updated] = await db
    .update(chantierPhasesTable)
    .set({
      ...rest,
      ...(avancementPercent !== undefined ? { avancementPercent: avancementPercent.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(chantierPhasesTable.id, req.params.id), eq(chantierPhasesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Phase introuvable" });
    return;
  }
  res.json(updated);
});
