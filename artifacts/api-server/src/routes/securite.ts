import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, securiteIncidentsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const securiteRouter = Router();

const incidentInputSchema = z.object({
  titre: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  typeIncident: z.string().min(1).max(200),
  gravite: z.enum(["FAIBLE", "MOYENNE", "ELEVEE", "CRITIQUE"]).optional(),
  projectId: z.string().uuid().optional(),
});

securiteRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(securiteIncidentsTable)
    .where(and(eq(securiteIncidentsTable.licenceId, licenceId), eq(securiteIncidentsTable.active, !onlyInactive)));

  res.json(rows);
});

securiteRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = incidentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(securiteIncidentsTable)
    .values({
      licenceId,
      titre: parsed.data.titre,
      description: parsed.data.description,
      typeIncident: parsed.data.typeIncident,
      gravite: parsed.data.gravite,
      projectId: parsed.data.projectId,
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
securiteRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(securiteIncidentsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(securiteIncidentsTable.id, req.params.id), eq(securiteIncidentsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Incident introuvable" });
    return;
  }
  res.json(updated);
});
