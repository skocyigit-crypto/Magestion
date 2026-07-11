import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, pointageTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const pointageRouter = Router();
pointageRouter.use(requireModuleAccess("pointage"));

pointageRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(pointageTable).where(eq(pointageTable.licenceId, licenceId));
  res.json(rows);
});

const arriveeSchema = z.object({ employeeId: z.string().uuid(), projectId: z.string().uuid().optional() });

pointageRouter.post("/arrivee", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = arriveeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  // Garde-fou : pas de double pointage ouvert (arrivee sans depart) pour le meme employe.
  const [ouvert] = await db
    .select()
    .from(pointageTable)
    .where(and(eq(pointageTable.employeeId, parsed.data.employeeId), eq(pointageTable.licenceId, licenceId), isNull(pointageTable.heureDepart)))
    .limit(1);
  if (ouvert) {
    res.status(409).json({ error: "Un pointage est deja ouvert pour cet employe (arrivee sans depart enregistre)" });
    return;
  }

  const [created] = await db
    .insert(pointageTable)
    .values({ licenceId, employeeId: parsed.data.employeeId, projectId: parsed.data.projectId })
    .returning();

  res.status(201).json(created);
});

pointageRouter.post("/:id/depart", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [existing] = await db
    .select()
    .from(pointageTable)
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Pointage introuvable" });
    return;
  }
  if (existing.heureDepart) {
    res.status(409).json({ error: "Depart deja enregistre" });
    return;
  }

  const [updated] = await db
    .update(pointageTable)
    .set({ heureDepart: new Date() })
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

const pointageUpdateSchema = z.object({
  heureArrivee: z.string().optional(),
  heureDepart: z.string().nullable().optional(),
  projectId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

// Correction manuelle (oubli de pointage, erreur de saisie) : pas de DELETE,
// archivage reversible via { active: false } (regle produit).
pointageRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = pointageUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { heureArrivee, heureDepart, ...rest } = parsed.data;
  const [updated] = await db
    .update(pointageTable)
    .set({
      ...rest,
      ...(heureArrivee !== undefined ? { heureArrivee: new Date(heureArrivee) } : {}),
      ...(heureDepart !== undefined ? { heureDepart: heureDepart ? new Date(heureDepart) : null } : {}),
    })
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pointage introuvable" });
    return;
  }
  res.json(updated);
});
