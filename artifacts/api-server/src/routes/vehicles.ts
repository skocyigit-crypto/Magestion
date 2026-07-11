import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, vehiclesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const vehiclesRouter = Router();

const TYPE_ENUM = z.enum(["CAMION", "CAMIONNETTE", "FOURGON", "VOITURE", "ENGIN_CHANTIER", "AUTRE"]);
const CARBURANT_ENUM = z.enum(["DIESEL", "ESSENCE", "ELECTRIQUE", "GPL", "HYBRIDE"]);
const STATUT_ENUM = z.enum(["DISPONIBLE", "EN_MISSION", "EN_MAINTENANCE", "HORS_SERVICE"]);

const vehicleInputSchema = z.object({
  immatriculation: z.string().min(1).max(20),
  marque: z.string().max(100).optional(),
  modele: z.string().max(100).optional(),
  type: TYPE_ENUM.optional(),
  carburant: CARBURANT_ENUM.optional(),
  kilometrage: z.number().nonnegative().optional(),
  dateAssuranceValidite: z.string().optional(),
  dateControleTechniqueValidite: z.string().optional(),
});

vehiclesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(vehiclesTable)
    .where(and(eq(vehiclesTable.licenceId, licenceId), eq(vehiclesTable.active, !onlyInactive)));

  res.json(rows);
});

vehiclesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = vehicleInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(vehiclesTable)
    .values({
      licenceId,
      immatriculation: parsed.data.immatriculation,
      marque: parsed.data.marque,
      modele: parsed.data.modele,
      type: parsed.data.type,
      carburant: parsed.data.carburant,
      kilometrage: parsed.data.kilometrage,
      dateAssuranceValidite: parsed.data.dateAssuranceValidite,
      dateControleTechniqueValidite: parsed.data.dateControleTechniqueValidite,
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
vehiclesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = vehicleInputSchema
    .partial()
    .extend({ statut: STATUT_ENUM.optional(), active: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(vehiclesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(vehiclesTable.id, req.params.id), eq(vehiclesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Vehicule introuvable" });
    return;
  }
  res.json(updated);
});
