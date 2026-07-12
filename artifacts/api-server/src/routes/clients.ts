import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, clientsTable, projectsTable, devisTable, facturesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const clientsRouter = Router();
clientsRouter.use(requireModuleAccess("clients"));

const TYPE_ENUM = z.enum(["PARTICULIER", "PROFESSIONNEL"]);

const clientInputSchema = z.object({
  type: TYPE_ENUM.optional(),
  nom: z.string().min(1).max(200),
  email: z.string().email().optional(),
  telephone: z.string().max(30).optional(),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  ville: z.string().max(200).optional(),
  siret: z.string().max(14).optional(),
  tvaIntracommunautaire: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

clientsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.licenceId, licenceId), eq(clientsTable.active, !onlyInactive)));

  res.json(rows);
});

clientsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = clientInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(clientsTable)
    .values({ licenceId, ...parsed.data })
    .returning();

  res.status(201).json(created);
});

clientsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.licenceId, licenceId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }
  res.json(client);
});

const clientUpdateSchema = clientInputSchema.partial().extend({ active: z.boolean().optional() });

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
clientsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = clientUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(clientsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }
  res.json(updated);
});

// Historique/risque : agrege les chantiers rattaches (project.clientId) et
// leurs devis/factures — permet de voir en un coup d'oeil le CA genere et les
// impayes (EN_RETARD) d'un meme client a travers plusieurs chantiers.
clientsRouter.get("/:id/historique", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [client] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.licenceId, licenceId)))
    .limit(1);
  if (!client) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.clientId, req.params.id), eq(projectsTable.licenceId, licenceId)));

  const projectIds = projects.map((p) => p.id);

  const allDevis = projectIds.length > 0
    ? await db.select().from(devisTable).where(and(eq(devisTable.licenceId, licenceId), eq(devisTable.active, true)))
    : [];
  const allFactures = projectIds.length > 0
    ? await db.select().from(facturesTable).where(and(eq(facturesTable.licenceId, licenceId), eq(facturesTable.active, true)))
    : [];

  const devisForClient = allDevis.filter((d) => d.projectId && projectIds.includes(d.projectId));
  const facturesForClient = allFactures.filter((f) => f.projectId && projectIds.includes(f.projectId));

  const caFacture = facturesForClient.reduce((s, f) => s + Number(f.montantHt), 0);
  const impayes = facturesForClient.filter((f) => f.statut === "EN_RETARD");
  const montantImpaye = impayes.reduce((s, f) => s + Number(f.montantHt), 0);

  res.json({
    projects,
    devis: devisForClient,
    factures: facturesForClient,
    caFactureHt: caFacture,
    montantImpayeHt: montantImpaye,
    nbFacturesImpayees: impayes.length,
  });
});
