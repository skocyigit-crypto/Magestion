import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, planningAffectationsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const planningPersonnelRouter = Router();

const TYPE_ENUM = z.enum(["CHANTIER", "CONGE", "MALADIE", "FORMATION", "DEPLACEMENT", "REPOS", "BUREAU"]);

planningPersonnelRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { debut, fin } = req.query;
  const conditions = [eq(planningAffectationsTable.licenceId, licenceId), eq(planningAffectationsTable.active, true)];
  if (typeof debut === "string") conditions.push(gte(planningAffectationsTable.date, debut));
  if (typeof fin === "string") conditions.push(lte(planningAffectationsTable.date, fin));

  const rows = await db.select().from(planningAffectationsTable).where(and(...conditions));
  res.json(rows);
});

const affectationInputSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  date: z.string(),
  type: TYPE_ENUM.optional(),
  chefEquipe: z.boolean().optional(),
});

// Detection de conflit automatique : un employe ne peut avoir qu'UNE seule
// affectation active par jour (chantier, conge, maladie...) — regle standard
// planning BTP, evite le double-booking.
planningPersonnelRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = affectationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [conflit] = await db
    .select()
    .from(planningAffectationsTable)
    .where(
      and(
        eq(planningAffectationsTable.licenceId, licenceId),
        eq(planningAffectationsTable.employeeId, parsed.data.employeeId),
        eq(planningAffectationsTable.date, parsed.data.date),
        eq(planningAffectationsTable.active, true),
      ),
    )
    .limit(1);
  if (conflit) {
    res.status(409).json({ error: "Conflit : cet employe a deja une affectation ce jour-la" });
    return;
  }

  const [created] = await db
    .insert(planningAffectationsTable)
    .values({
      licenceId,
      employeeId: parsed.data.employeeId,
      projectId: parsed.data.projectId,
      date: parsed.data.date,
      type: parsed.data.type,
      chefEquipe: parsed.data.chefEquipe ?? false,
    })
    .returning();

  res.status(201).json(created);
});

// Retrait = desactivation reversible (regle produit, pas de DELETE).
planningPersonnelRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(planningAffectationsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(planningAffectationsTable.id, req.params.id), eq(planningAffectationsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Affectation introuvable" });
    return;
  }
  res.json(updated);
});
