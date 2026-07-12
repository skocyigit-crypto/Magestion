import { Router } from "express";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db, licencesTable, usersTable } from "@magestion/db";
import { isPlatformOwner } from "../lib/tenantScope.js";

export const superAdminRouter = Router();

// Cross-tenant : jamais de requireModuleAccess/requireLicenceId ici (ces
// helpers exigent ou scopent sur une licence). Seul un compte SUPER_ADMIN
// sans licence (licenceId=null, "platform owner" — voir schema/users.ts et
// lib/tenantScope.ts) passe ; tout utilisateur tenant ordinaire, y compris
// un SUPER_ADMIN de licence, recoit 403.
superAdminRouter.use((req, res, next) => {
  if (!isPlatformOwner(req.user!)) {
    res.status(403).json({ error: "Reserve au proprietaire de la plateforme" });
    return;
  }
  next();
});

superAdminRouter.get("/licences", async (_req, res) => {
  const licences = await db.select().from(licencesTable);
  const usersCounts = await db
    .select({ licenceId: usersTable.licenceId, total: count() })
    .from(usersTable)
    .groupBy(usersTable.licenceId);

  const countByLicence = new Map(usersCounts.filter((u) => u.licenceId).map((u) => [u.licenceId as string, u.total]));

  res.json(
    licences.map((l) => ({
      ...l,
      nbUtilisateurs: countByLicence.get(l.id) ?? 0,
    })),
  );
});

superAdminRouter.get("/stats", async (_req, res) => {
  const licences = await db.select({ plan: licencesTable.plan, status: licencesTable.status }).from(licencesTable);

  res.json({
    totalLicences: licences.length,
    parPlan: {
      TRIAL: licences.filter((l) => l.plan === "TRIAL").length,
      STARTER: licences.filter((l) => l.plan === "STARTER").length,
      PME: licences.filter((l) => l.plan === "PME").length,
      ENTREPRISE: licences.filter((l) => l.plan === "ENTREPRISE").length,
    },
    actives: licences.filter((l) => l.status === "ACTIF").length,
    suspendues: licences.filter((l) => l.status === "SUSPENDU").length,
  });
});

superAdminRouter.get("/licences/:id", async (req, res) => {
  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, req.params.id)).limit(1);
  if (!licence) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, nom: usersTable.nom, role: usersTable.role, active: usersTable.active })
    .from(usersTable)
    .where(eq(usersTable.licenceId, req.params.id));

  res.json({ licence, users });
});

const licenceUpdateSchema = z.object({
  status: z.enum(["ACTIF", "SUSPENDU", "ARCHIVE"]).optional(),
  plan: z.enum(["TRIAL", "STARTER", "PME", "ENTREPRISE"]).optional(),
});

// Intervention manuelle du proprietaire de la plateforme (support client,
// litige de paiement...) — distinct du flux Stripe self-service normal
// (routes/billing.ts). Pas de DELETE : archivage via status=ARCHIVE.
superAdminRouter.patch("/licences/:id", async (req, res) => {
  const parsed = licenceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(licencesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(licencesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }
  res.json(updated);
});
