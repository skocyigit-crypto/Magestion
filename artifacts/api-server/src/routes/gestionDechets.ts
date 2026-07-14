import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, dechetsChantierTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const gestionDechetsRouter = Router();
gestionDechetsRouter.use(requireModuleAccess("gestionDechets"));

const dechetInputSchema = z.object({
  projectId: z.string().uuid(),
  typeDechet: z.enum(["INERTES", "NON_DANGEREUX_NON_INERTES", "DANGEREUX"]),
  natureDechet: z.string().min(1).max(200),
  quantite: z.number().positive(),
  unite: z.string().max(20).optional(),
  collecteur: z.string().max(300).optional(),
  fournisseurId: z.string().uuid().optional(),
  dateEnlevement: z.string(),
  destination: z.enum(["REEMPLOI", "RECYCLAGE", "VALORISATION_ENERGETIQUE", "ELIMINATION", "STOCKAGE"]).optional(),
  bordereauNumero: z.string().max(100).optional(),
  notes: z.string().optional(),
});

const dechetUpdateSchema = dechetInputSchema.partial().extend({
  active: z.boolean().optional(),
});

gestionDechetsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { projectId, onlyInactive } = req.query;
  const conditions = [eq(dechetsChantierTable.licenceId, licenceId), eq(dechetsChantierTable.active, onlyInactive === "true" ? false : true)];
  if (typeof projectId === "string") conditions.push(eq(dechetsChantierTable.projectId, projectId));

  const rows = await db
    .select()
    .from(dechetsChantierTable)
    .where(and(...conditions));
  res.json(rows);
});

gestionDechetsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = dechetInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.typeDechet === "DANGEREUX" && !parsed.data.bordereauNumero) {
    res.status(400).json({ error: "Le numero de bordereau (BSDD) est obligatoire pour un dechet dangereux" });
    return;
  }

  const { quantite, ...rest } = parsed.data;
  const [created] = await db
    .insert(dechetsChantierTable)
    .values({ licenceId, ...rest, quantite: quantite.toString() })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
gestionDechetsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = dechetUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { quantite, ...rest } = parsed.data;
  const [updated] = await db
    .update(dechetsChantierTable)
    .set({ ...rest, ...(quantite !== undefined ? { quantite: quantite.toString() } : {}), updatedAt: new Date() })
    .where(and(eq(dechetsChantierTable.id, req.params.id), eq(dechetsChantierTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Enlevement de dechets introuvable" });
    return;
  }
  res.json(updated);
});
