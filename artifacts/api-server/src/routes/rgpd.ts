import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, employeesTable, prospectsTable, pointageTable, planningAffectationsTable, journalRgpdTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

// "rgpd" est deliberement absent de MODULE_ACCESS (comme "users"/"parametres")
// : seul SUPER_ADMIN peut exporter/anonymiser des donnees personnelles.
export const rgpdRouter = Router();
rgpdRouter.use(requireModuleAccess("rgpd"));

rgpdRouter.get("/journal", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(journalRgpdTable).where(eq(journalRgpdTable.licenceId, licenceId));
  res.json(rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
});

// Droit d'acces/portabilite (art. 15/20 RGPD) : regroupe toutes les donnees
// detenues sur une personne. Chaque appel est lui-meme journalise (l'export
// EST un traitement de donnees personnelles a tracer).
rgpdRouter.get("/export/:entityType/:entityId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { entityType, entityId } = req.params;
  if (entityType !== "EMPLOYEE" && entityType !== "PROSPECT") {
    res.status(400).json({ error: "entityType doit etre EMPLOYEE ou PROSPECT" });
    return;
  }

  let data: unknown;
  if (entityType === "EMPLOYEE") {
    const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, entityId), eq(employeesTable.licenceId, licenceId))).limit(1);
    if (!employee) {
      res.status(404).json({ error: "Employe introuvable" });
      return;
    }
    const pointages = await db.select().from(pointageTable).where(and(eq(pointageTable.employeeId, entityId), eq(pointageTable.licenceId, licenceId)));
    const affectations = await db.select().from(planningAffectationsTable).where(and(eq(planningAffectationsTable.employeeId, entityId), eq(planningAffectationsTable.licenceId, licenceId)));
    data = { employee, pointages, affectations };
  } else {
    const [prospect] = await db.select().from(prospectsTable).where(and(eq(prospectsTable.id, entityId), eq(prospectsTable.licenceId, licenceId))).limit(1);
    if (!prospect) {
      res.status(404).json({ error: "Prospect introuvable" });
      return;
    }
    data = { prospect };
  }

  await db.insert(journalRgpdTable).values({
    licenceId,
    action: "EXPORT",
    entityType,
    entityId,
    effectuePar: req.user!.sub,
  });

  res.json(data);
});

// Droit a l'effacement (art. 17 RGPD), concilie avec la regle produit
// absolue "aucune suppression physique" : anonymisation irreversible des
// champs identifiants plutot qu'un DELETE. L'historique (pointages,
// affectations, statistiques) reste intact mais ne pointe plus vers une
// personne identifiable. Aucune route de reversion — c'est le sens meme
// de l'anonymisation.
rgpdRouter.post("/anonymiser/:entityType/:entityId", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { entityType, entityId } = req.params;
  if (entityType !== "EMPLOYEE" && entityType !== "PROSPECT") {
    res.status(400).json({ error: "entityType doit etre EMPLOYEE ou PROSPECT" });
    return;
  }

  const suffix = entityId.slice(0, 8);

  if (entityType === "EMPLOYEE") {
    const [updated] = await db
      .update(employeesTable)
      .set({ nom: "Anonymise", prenom: suffix, telephone: null, email: null, anonymise: true, active: false, updatedAt: new Date() })
      .where(and(eq(employeesTable.id, entityId), eq(employeesTable.licenceId, licenceId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Employe introuvable" });
      return;
    }
  } else {
    const [updated] = await db
      .update(prospectsTable)
      .set({ nom: `Anonymise-${suffix}`, contact: null, telephone: null, email: null, adresse: null, anonymise: true, active: false, updatedAt: new Date() })
      .where(and(eq(prospectsTable.id, entityId), eq(prospectsTable.licenceId, licenceId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Prospect introuvable" });
      return;
    }
  }

  await db.insert(journalRgpdTable).values({
    licenceId,
    action: "ANONYMISATION",
    entityType,
    entityId,
    effectuePar: req.user!.sub,
  });

  res.json({ ok: true });
});
