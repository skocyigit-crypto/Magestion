import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, employeesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const employeesRouter = Router();
employeesRouter.use(requireModuleAccess("employees"));

const ROLE_ENUM = z.enum([
  "CHEF_CHANTIER", "CONDUCTEUR_TRAVAUX", "MACON", "ELECTRICIEN", "PLOMBIER",
  "CHARPENTIER", "COUVREUR", "PEINTRE", "CARRELEUR", "MANOEUVRE", "AUTRE",
]);

// Palette distincte (rotation par nombre d'employes existants) — chaque
// nouvel employe recoit automatiquement une couleur differente de la precedente.
const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const employeeInputSchema = z.object({
  nom: z.string().min(1).max(100),
  prenom: z.string().min(1).max(100),
  role: ROLE_ENUM.optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  tauxHoraire: z.number().nonnegative().max(999999.99).optional(),
});

const employeeUpdateSchema = employeeInputSchema.partial().extend({
  statut: z.enum(["SUR_CHANTIER", "EN_ROUTE", "ABSENT", "INDISPONIBLE", "CONGE"]).optional(),
  active: z.boolean().optional(),
});

employeesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.licenceId, licenceId), eq(employeesTable.active, !onlyInactive)));

  res.json(rows);
});

employeesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = employeeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existingCount = await db.select().from(employeesTable).where(eq(employeesTable.licenceId, licenceId));
  const couleur = PALETTE[existingCount.length % PALETTE.length];

  const [created] = await db
    .insert(employeesTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      role: parsed.data.role,
      telephone: parsed.data.telephone,
      email: parsed.data.email || undefined,
      tauxHoraire: parsed.data.tauxHoraire?.toString(),
      couleur,
    })
    .returning();

  res.status(201).json(created);
});

employeesRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId)))
    .limit(1);

  if (!employee) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }
  res.json(employee);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
employeesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = employeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { tauxHoraire, ...rest } = parsed.data;
  const [updated] = await db
    .update(employeesTable)
    .set({
      ...rest,
      ...(tauxHoraire !== undefined ? { tauxHoraire: tauxHoraire.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }
  res.json(updated);
});
