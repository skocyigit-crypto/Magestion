import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, demandesAchatTable, commandesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const demandesAchatRouter = Router();
demandesAchatRouter.use(requireModuleAccess("demandesAchat"));

const demandeInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  demandeurId: z.string().uuid().optional(),
  objet: z.string().min(1).max(500),
  quantiteEstimee: z.string().max(100).optional(),
  montantEstimeHt: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const demandeUpdateSchema = demandeInputSchema.partial().extend({
  active: z.boolean().optional(),
});

demandesAchatRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const conditions = [eq(demandesAchatTable.licenceId, licenceId), eq(demandesAchatTable.active, !onlyInactive)];
  if (typeof req.query.projectId === "string") conditions.push(eq(demandesAchatTable.projectId, req.query.projectId));

  const rows = await db
    .select()
    .from(demandesAchatTable)
    .where(and(...conditions));
  res.json(rows);
});

demandesAchatRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = demandeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantEstimeHt, ...rest } = parsed.data;
  const [created] = await db
    .insert(demandesAchatTable)
    .values({ licenceId, ...rest, montantEstimeHt: montantEstimeHt?.toString() })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// Modification libre uniquement tant que EN_ATTENTE — au-dela, seul le statut evolue.
demandesAchatRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = demandeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(demandesAchatTable)
    .where(and(eq(demandesAchatTable.id, req.params.id), eq(demandesAchatTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Demande d'achat introuvable" });
    return;
  }

  const { montantEstimeHt, active, ...rest } = parsed.data;
  const touchesContent = Object.keys(rest).length > 0 || montantEstimeHt !== undefined;
  if (touchesContent && existing.statut !== "EN_ATTENTE") {
    res.status(423).json({ error: "Demande deja traitee — seul l'archivage reste possible" });
    return;
  }

  const [updated] = await db
    .update(demandesAchatTable)
    .set({
      ...rest,
      ...(montantEstimeHt !== undefined ? { montantEstimeHt: montantEstimeHt.toString() } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(demandesAchatTable.id, existing.id))
    .returning();
  res.json(updated);
});

demandesAchatRouter.post("/:id/approuver", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [demande] = await db
    .select()
    .from(demandesAchatTable)
    .where(and(eq(demandesAchatTable.id, req.params.id), eq(demandesAchatTable.licenceId, licenceId)))
    .limit(1);
  if (!demande) {
    res.status(404).json({ error: "Demande d'achat introuvable" });
    return;
  }
  if (demande.statut !== "EN_ATTENTE") {
    res.status(409).json({ error: "Seule une demande EN_ATTENTE peut etre approuvee" });
    return;
  }

  const [updated] = await db
    .update(demandesAchatTable)
    .set({ statut: "APPROUVEE", updatedAt: new Date() })
    .where(eq(demandesAchatTable.id, demande.id))
    .returning();
  res.json(updated);
});

demandesAchatRouter.post("/:id/rejeter", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ motifRejet: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [demande] = await db
    .select()
    .from(demandesAchatTable)
    .where(and(eq(demandesAchatTable.id, req.params.id), eq(demandesAchatTable.licenceId, licenceId)))
    .limit(1);
  if (!demande) {
    res.status(404).json({ error: "Demande d'achat introuvable" });
    return;
  }
  if (demande.statut !== "EN_ATTENTE") {
    res.status(409).json({ error: "Seule une demande EN_ATTENTE peut etre rejetee" });
    return;
  }

  const [updated] = await db
    .update(demandesAchatTable)
    .set({ statut: "REJETEE", motifRejet: parsed.data.motifRejet, updatedAt: new Date() })
    .where(eq(demandesAchatTable.id, demande.id))
    .returning();
  res.json(updated);
});

const convertirInputSchema = z.object({
  fournisseur: z.string().min(1).max(200),
  fournisseurId: z.string().uuid().optional(),
  montantHt: z.number().nonnegative(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  dateLivraisonPrevue: z.string().optional(),
});

// Concretise une demande APPROUVEE en commande fournisseur. Idempotent : si
// une commande est deja liee (CONVERTIE), la retourne au lieu d'en recreer une.
demandesAchatRouter.post("/:id/convertir-commande", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = convertirInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [demande] = await db
    .select()
    .from(demandesAchatTable)
    .where(and(eq(demandesAchatTable.id, req.params.id), eq(demandesAchatTable.licenceId, licenceId)))
    .limit(1);
  if (!demande) {
    res.status(404).json({ error: "Demande d'achat introuvable" });
    return;
  }

  if (demande.commandeId) {
    const [commande] = await db.select().from(commandesTable).where(eq(commandesTable.id, demande.commandeId)).limit(1);
    res.json({ demande, commande });
    return;
  }

  if (demande.statut !== "APPROUVEE") {
    res.status(409).json({ error: "Seule une demande APPROUVEE peut etre convertie en commande" });
    return;
  }

  const [commande] = await db
    .insert(commandesTable)
    .values({
      licenceId,
      projectId: demande.projectId,
      fournisseur: parsed.data.fournisseur,
      fournisseurId: parsed.data.fournisseurId,
      objet: demande.objet,
      montantHt: parsed.data.montantHt.toString(),
      tauxTva: parsed.data.tauxTva.toString(),
      dateLivraisonPrevue: parsed.data.dateLivraisonPrevue,
    })
    .returning();

  const [updatedDemande] = await db
    .update(demandesAchatTable)
    .set({ statut: "CONVERTIE", commandeId: commande.id, updatedAt: new Date() })
    .where(eq(demandesAchatTable.id, demande.id))
    .returning();

  res.status(201).json({ demande: updatedDemande, commande });
});
