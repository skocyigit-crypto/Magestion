import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, appelsOffresTable, marchesPublicsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { withNumero } from "../lib/numbering.js";

export const appelsOffresRouter = Router();
appelsOffresRouter.use(requireModuleAccess("appelsOffres"));

const appelOffreInputSchema = z.object({
  reference: z.string().max(200).optional(),
  intitule: z.string().min(1).max(500),
  organisme: z.string().max(300).optional(),
  clientId: z.string().uuid().optional(),
  typeProcedure: z.enum(["MAPA", "AOO", "AOR", "DIALOGUE_COMPETITIF", "NEGOCIEE"]).optional(),
  datePublication: z.string().optional(),
  dateLimiteDepot: z.string().optional(),
  lieu: z.string().max(300).optional(),
  categorie: z.string().max(200).optional(),
  montantEstimeHt: z.number().nonnegative().optional(),
  montantOffreHt: z.number().nonnegative().optional(),
  delaiProposeJours: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

const appelOffreUpdateSchema = appelOffreInputSchema.partial().extend({
  active: z.boolean().optional(),
});

appelsOffresRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(appelsOffresTable)
    .where(and(eq(appelsOffresTable.licenceId, licenceId), eq(appelsOffresTable.active, !onlyInactive)));
  res.json(rows);
});

appelsOffresRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = appelOffreInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantEstimeHt, montantOffreHt, dateLimiteDepot, ...rest } = parsed.data;
  const [created] = await db
    .insert(appelsOffresTable)
    .values({
      licenceId,
      ...rest,
      dateLimiteDepot: dateLimiteDepot ? new Date(dateLimiteDepot) : undefined,
      montantEstimeHt: montantEstimeHt?.toString(),
      montantOffreHt: montantOffreHt?.toString(),
    })
    .returning();
  res.status(201).json(created);
});

appelsOffresRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [row] = await db
    .select()
    .from(appelsOffresTable)
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Appel d'offres introuvable" });
    return;
  }
  res.json(row);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
appelsOffresRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = appelOffreUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(appelsOffresTable)
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Appel d'offres introuvable" });
    return;
  }
  if (existing.statut === "GAGNE") {
    res.status(423).json({ error: "Appel d'offres gagne : le marche cree fait desormais foi, seul l'archivage reste possible ici" });
    return;
  }

  const { montantEstimeHt, montantOffreHt, dateLimiteDepot, ...rest } = parsed.data;
  const [updated] = await db
    .update(appelsOffresTable)
    .set({
      ...rest,
      ...(dateLimiteDepot !== undefined ? { dateLimiteDepot: new Date(dateLimiteDepot) } : {}),
      ...(montantEstimeHt !== undefined ? { montantEstimeHt: montantEstimeHt.toString() } : {}),
      ...(montantOffreHt !== undefined ? { montantOffreHt: montantOffreHt.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .returning();
  res.json(updated);
});

// Transitions simples (hors GAGNE, qui a l'effet de bord de creer un marche —
// voir POST /:id/gagner ci-dessous).
const TRANSITIONS: Record<string, string[]> = {
  VEILLE: ["EN_PREPARATION", "PERDU"],
  EN_PREPARATION: ["DEPOSE", "PERDU"],
  DEPOSE: ["RETENU", "REJETE"],
  RETENU: ["PERDU"], // GAGNE passe exclusivement par /gagner
  REJETE: [],
  GAGNE: [],
  PERDU: [],
};

appelsOffresRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["EN_PREPARATION", "DEPOSE", "RETENU", "REJETE", "PERDU"]), motifRejet: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [row] = await db
    .select()
    .from(appelsOffresTable)
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Appel d'offres introuvable" });
    return;
  }
  if (!TRANSITIONS[row.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${row.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const [updated] = await db
    .update(appelsOffresTable)
    .set({ statut: parsed.data.statut, motifRejet: parsed.data.motifRejet, updatedAt: new Date() })
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .returning();
  res.json(updated);
});

// Concretise un appel d'offres RETENU en marche public notifie. Idempotent :
// si un marche est deja lie, le retourne au lieu d'en recreer un.
appelsOffresRouter.post("/:id/gagner", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z
    .object({
      clientId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [ao] = await db
    .select()
    .from(appelsOffresTable)
    .where(and(eq(appelsOffresTable.id, req.params.id), eq(appelsOffresTable.licenceId, licenceId)))
    .limit(1);
  if (!ao) {
    res.status(404).json({ error: "Appel d'offres introuvable" });
    return;
  }

  if (ao.marcheId) {
    const [marche] = await db.select().from(marchesPublicsTable).where(eq(marchesPublicsTable.id, ao.marcheId)).limit(1);
    res.json({ appelOffre: ao, marche });
    return;
  }

  if (ao.statut !== "RETENU") {
    res.status(409).json({ error: "Seul un appel d'offres RETENU peut etre transforme en marche" });
    return;
  }

  const clientId = parsed.data.clientId ?? ao.clientId;
  if (!clientId) {
    res.status(400).json({ error: "clientId requis (aucun client associe a l'appel d'offres)" });
    return;
  }

  const montantInitialHt = ao.montantOffreHt ?? ao.montantEstimeHt ?? "0";
  const marche = await withNumero("marches_publics", "MP", licenceId, async (numero) => {
    const [row] = await db
      .insert(marchesPublicsTable)
      .values({
        licenceId,
        numero,
        intitule: ao.intitule,
        clientId,
        projectId: parsed.data.projectId,
        montantInitialHt: montantInitialHt.toString(),
        montantActuelHt: montantInitialHt.toString(),
        tauxTva: (parsed.data.tauxTva ?? 20).toString(),
      })
      .returning();
    return row;
  });

  const [updatedAo] = await db
    .update(appelsOffresTable)
    .set({ statut: "GAGNE", marcheId: marche.id, updatedAt: new Date() })
    .where(eq(appelsOffresTable.id, ao.id))
    .returning();

  res.status(201).json({ appelOffre: updatedAo, marche });
});
