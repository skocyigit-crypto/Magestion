import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, employeesTable, employeeHabilitationsTable } from "@magestion/db";
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

// Echeances RH sous 30 jours (deja expirees incluses) tous employes/tous
// types confondus — route litterale, doit rester AVANT /:id (sinon "echeances"
// serait interprete comme un id). Calcule a la volee depuis date_validite,
// meme principe que /relances/a-faire.
employeesRouter.get("/echeances", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const habilitations = await db
    .select()
    .from(employeeHabilitationsTable)
    .where(and(eq(employeeHabilitationsTable.licenceId, licenceId), eq(employeeHabilitationsTable.active, true)));
  const employees = await db.select().from(employeesTable).where(and(eq(employeesTable.licenceId, licenceId), eq(employeesTable.active, true)));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const dans30Jours = new Date();
  dans30Jours.setDate(dans30Jours.getDate() + 30);

  const echeances = habilitations
    .filter((h) => employeeById.has(h.employeeId) && new Date(h.dateValidite) <= dans30Jours)
    .map((h) => {
      const employee = employeeById.get(h.employeeId)!;
      const joursRestants = Math.floor((new Date(h.dateValidite).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        id: h.id,
        employeeId: h.employeeId,
        employeeNom: `${employee.prenom} ${employee.nom}`,
        type: h.type,
        libelle: h.libelle,
        dateValidite: h.dateValidite,
        joursRestants,
        expiree: joursRestants < 0,
      };
    })
    .sort((a, b) => a.joursRestants - b.joursRestants);

  res.json(echeances);
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

employeesRouter.get("/:id/habilitations", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(employeeHabilitationsTable)
    .where(and(eq(employeeHabilitationsTable.employeeId, req.params.id), eq(employeeHabilitationsTable.licenceId, licenceId), eq(employeeHabilitationsTable.active, true)));
  res.json(rows);
});

const habilitationInputSchema = z.object({
  type: z.enum(["CARTE_BTP", "VISITE_MEDICALE", "CACES", "TITRE_SEJOUR", "HABILITATION_ELECTRIQUE", "AUTRE"]),
  libelle: z.string().max(200).optional(),
  dateValidite: z.string(),
});

employeesRouter.post("/:id/habilitations", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = habilitationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId))).limit(1);
  if (!employee) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }

  const [created] = await db
    .insert(employeeHabilitationsTable)
    .values({ licenceId, employeeId: employee.id, type: parsed.data.type, libelle: parsed.data.libelle, dateValidite: parsed.data.dateValidite })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle
// produit) — un renouvellement se saisit comme une NOUVELLE habilitation,
// l'ancienne est archivee pour garder l'historique des echeances passees.
employeesRouter.patch("/habilitations/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(employeeHabilitationsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(employeeHabilitationsTable.id, req.params.id), eq(employeeHabilitationsTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Habilitation introuvable" });
    return;
  }
  res.json(updated);
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
