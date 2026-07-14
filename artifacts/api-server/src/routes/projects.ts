import { Router } from "express";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, projectsTable, facturesTable, depensesTable, commandesTable, pointageTable, employeesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const projectsRouter = Router();
projectsRouter.use(requireModuleAccess("chantiers"));

const projectInputSchema = z.object({
  nom: z.string().min(1).max(200),
  client: z.string().min(1).max(200),
  clientId: z.string().uuid().optional(),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  budgetEstimeHt: z.number().nonnegative().max(9999999999.99).optional(),
  objectifMargePercent: z.number().min(0).max(100).optional(),
  categorie: z.enum(["RENOVATION", "CONSTRUCTION_NEUVE", "ISOLATION", "EXTENSION", "AUTRE"]).optional(),
});

const projectUpdateSchema = projectInputSchema.partial().extend({
  statut: z.enum(["EN_ATTENTE", "EN_COURS", "TERMINE", "SUSPENDU"]).optional(),
  active: z.boolean().optional(),
});

// GET /projects?onlyInactive=true -> corbeille (archives), sinon liste active par defaut
projectsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.licenceId, licenceId), eq(projectsTable.active, !onlyInactive)));

  res.json(rows);
});

projectsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = projectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(projectsTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      client: parsed.data.client,
      clientId: parsed.data.clientId,
      adresse: parsed.data.adresse,
      codePostal: parsed.data.codePostal,
      budgetEstimeHt: parsed.data.budgetEstimeHt?.toString(),
      objectifMargePercent: parsed.data.objectifMargePercent?.toString(),
      categorie: parsed.data.categorie,
    })
    .returning();

  res.status(201).json(created);
});

projectsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.licenceId, licenceId)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }
  res.json(project);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
projectsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { budgetEstimeHt, objectifMargePercent, ...rest } = parsed.data;
  const [updated] = await db
    .update(projectsTable)
    .set({
      ...rest,
      ...(budgetEstimeHt !== undefined ? { budgetEstimeHt: budgetEstimeHt.toString() } : {}),
      ...(objectifMargePercent !== undefined ? { objectifMargePercent: objectifMargePercent.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }
  res.json(updated);
});

// Rentabilite reelle du chantier : chiffre d'affaires facture vs couts engages
// (materiaux/sous-traitance + main d'oeuvre au taux horaire employe), compare
// a l'objectif de marge du chantier. Pure agregation en lecture, aucune donnee
// stockee (recalcule a chaque appel — coherent avec immobilisations/amortissement).
projectsRouter.get("/:id/rentabilite", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.id), eq(projectsTable.licenceId, licenceId)))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }

  const [factures, depenses, commandes, pointages, employees] = await Promise.all([
    db.select().from(facturesTable).where(and(eq(facturesTable.licenceId, licenceId), eq(facturesTable.projectId, project.id), eq(facturesTable.active, true), ne(facturesTable.statut, "BROUILLON"))),
    db.select().from(depensesTable).where(and(eq(depensesTable.licenceId, licenceId), eq(depensesTable.projectId, project.id), eq(depensesTable.active, true))),
    db.select().from(commandesTable).where(and(eq(commandesTable.licenceId, licenceId), eq(commandesTable.projectId, project.id), eq(commandesTable.active, true))),
    db.select().from(pointageTable).where(and(eq(pointageTable.licenceId, licenceId), eq(pointageTable.projectId, project.id), eq(pointageTable.active, true))),
    db.select().from(employeesTable).where(eq(employeesTable.licenceId, licenceId)),
  ]);

  const tauxHoraireParEmploye = new Map(employees.map((e) => [e.id, Number(e.tauxHoraire)]));

  const revenuHt = factures.reduce((s, f) => s + Number(f.montantHt), 0);
  const coutMateriauxHt = depenses.reduce((s, d) => s + Number(d.montantHt), 0) + commandes.reduce((s, c) => s + Number(c.montantHt), 0);

  let heuresTravaillees = 0;
  let coutMainOeuvreHt = 0;
  for (const p of pointages) {
    if (!p.heureDepart) continue; // pointage en cours, pas encore de duree
    const heures = (new Date(p.heureDepart).getTime() - new Date(p.heureArrivee).getTime()) / 3600000;
    if (heures <= 0) continue;
    heuresTravaillees += heures;
    coutMainOeuvreHt += heures * (tauxHoraireParEmploye.get(p.employeeId) ?? 0);
  }

  const coutTotalHt = coutMateriauxHt + coutMainOeuvreHt;
  const margeReelleHt = revenuHt - coutTotalHt;
  const margeReellePercent = revenuHt > 0 ? (margeReelleHt / revenuHt) * 100 : null;

  res.json({
    revenuHt,
    coutMateriauxHt,
    coutMainOeuvreHt,
    coutTotalHt,
    margeReelleHt,
    margeReellePercent,
    heuresTravaillees,
    objectifMargePercent: Number(project.objectifMargePercent),
  });
});
