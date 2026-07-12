import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, notesDeFraisTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const notesDeFraisRouter = Router();
notesDeFraisRouter.use(requireModuleAccess("notesDeFrais"));

const categorieEnum = z.enum(["DEPLACEMENT", "REPAS", "MATERIEL", "HEBERGEMENT", "AUTRE"]);

const noteInputSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  dateDepense: z.string(),
  categorie: categorieEnum.optional(),
  motif: z.string().min(1).max(500),
  montant: z.number().positive().max(999999.99),
});

const noteUpdateSchema = noteInputSchema.partial().extend({ active: z.boolean().optional() });

notesDeFraisRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(notesDeFraisTable)
    .where(and(eq(notesDeFraisTable.licenceId, licenceId), eq(notesDeFraisTable.active, !onlyInactive)));
  res.json(rows);
});

notesDeFraisRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = noteInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(notesDeFraisTable)
    .values({
      licenceId,
      employeeId: parsed.data.employeeId,
      projectId: parsed.data.projectId,
      dateDepense: parsed.data.dateDepense,
      categorie: parsed.data.categorie,
      motif: parsed.data.motif,
      montant: parsed.data.montant.toString(),
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
notesDeFraisRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = noteUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montant, ...rest } = parsed.data;
  const [updated] = await db
    .update(notesDeFraisTable)
    .set({ ...rest, ...(montant !== undefined ? { montant: montant.toString() } : {}), updatedAt: new Date() })
    .where(and(eq(notesDeFraisTable.id, req.params.id), eq(notesDeFraisTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Note de frais introuvable" });
    return;
  }
  res.json(updated);
});

const TRANSITIONS: Record<string, string[]> = {
  SOUMISE: ["VALIDEE", "REFUSEE"],
  VALIDEE: ["REMBOURSEE", "REFUSEE"],
  REFUSEE: ["SOUMISE"],
  REMBOURSEE: [],
};

notesDeFraisRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["VALIDEE", "REMBOURSEE", "REFUSEE", "SOUMISE"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [note] = await db
    .select()
    .from(notesDeFraisTable)
    .where(and(eq(notesDeFraisTable.id, req.params.id), eq(notesDeFraisTable.licenceId, licenceId)))
    .limit(1);
  if (!note) {
    res.status(404).json({ error: "Note de frais introuvable" });
    return;
  }
  if (!TRANSITIONS[note.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${note.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const [updated] = await db
    .update(notesDeFraisTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "REMBOURSEE" ? { dateRemboursement: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(notesDeFraisTable.id, req.params.id), eq(notesDeFraisTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});
