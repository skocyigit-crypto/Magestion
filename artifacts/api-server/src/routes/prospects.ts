import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, prospectsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { computeLeadScore } from "../lib/leadScoring.js";

export const prospectsRouter = Router();

const urgenceEnum = z.enum(["BASSE", "NORMALE", "URGENTE", "TRES_URGENTE"]);
const statutEnum = z.enum(["NOUVEAU", "CONTACTE", "RDV_PLANIFIE", "DEVIS_ENVOYE", "NEGOCIATION", "GAGNE", "PERDU"]);

const prospectInputSchema = z.object({
  nom: z.string().min(1).max(200),
  contact: z.string().max(200).optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  budgetEstime: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  urgence: urgenceEnum.optional(),
  notes: z.string().max(4000).optional(),
});

const prospectUpdateSchema = prospectInputSchema.partial().extend({
  statut: statutEnum.optional(),
  active: z.boolean().optional(),
});

// GET /prospects?onlyInactive=true -> corbeille (archives), sinon liste active par defaut
prospectsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.licenceId, licenceId), eq(prospectsTable.active, !onlyInactive)));

  res.json(rows);
});

prospectsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = prospectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const budgetEstime = parsed.data.budgetEstime ?? 0;
  const urgence = parsed.data.urgence ?? "NORMALE";
  const score = computeLeadScore({ budgetEstime, urgence, distanceKm: parsed.data.distanceKm });

  const [created] = await db
    .insert(prospectsTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      contact: parsed.data.contact,
      telephone: parsed.data.telephone,
      email: parsed.data.email || undefined,
      adresse: parsed.data.adresse,
      codePostal: parsed.data.codePostal,
      budgetEstime: budgetEstime.toString(),
      distanceKm: parsed.data.distanceKm?.toString(),
      urgence,
      notes: parsed.data.notes,
      score,
    })
    .returning();

  res.status(201).json(created);
});

prospectsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [prospect] = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .limit(1);

  if (!prospect) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }
  res.json(prospect);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
prospectsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = prospectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }

  const { budgetEstime, distanceKm, urgence, ...rest } = parsed.data;
  // Recalcul du score si l'un des facteurs change (budget/urgence/distance).
  const nextBudget = budgetEstime ?? Number(existing.budgetEstime);
  const nextUrgence = urgence ?? existing.urgence;
  const nextDistance = distanceKm ?? (existing.distanceKm ? Number(existing.distanceKm) : undefined);
  const score = computeLeadScore({ budgetEstime: nextBudget, urgence: nextUrgence, distanceKm: nextDistance });

  const [updated] = await db
    .update(prospectsTable)
    .set({
      ...rest,
      ...(budgetEstime !== undefined ? { budgetEstime: budgetEstime.toString() } : {}),
      ...(distanceKm !== undefined ? { distanceKm: distanceKm.toString() } : {}),
      ...(urgence !== undefined ? { urgence } : {}),
      score,
      updatedAt: new Date(),
    })
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});
