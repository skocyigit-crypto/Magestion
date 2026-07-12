import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, commandesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const commandesRouter = Router();
commandesRouter.use(requireModuleAccess("commandes"));

const commandeInputSchema = z.object({
  fournisseur: z.string().min(1).max(200),
  fournisseurId: z.string().uuid().optional(),
  objet: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
  montantHt: z.number().nonnegative().max(9999999999.99),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  dateLivraisonPrevue: z.string().optional(),
});

const commandeUpdateSchema = commandeInputSchema.partial().extend({
  active: z.boolean().optional(),
});

commandesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(commandesTable)
    .where(and(eq(commandesTable.licenceId, licenceId), eq(commandesTable.active, !onlyInactive)));

  res.json(rows);
});

commandesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = commandeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(commandesTable)
    .values({
      licenceId,
      fournisseur: parsed.data.fournisseur,
      fournisseurId: parsed.data.fournisseurId,
      objet: parsed.data.objet,
      projectId: parsed.data.projectId,
      montantHt: parsed.data.montantHt.toString(),
      tauxTva: parsed.data.tauxTva.toString(),
      dateLivraisonPrevue: parsed.data.dateLivraisonPrevue,
    })
    .returning();

  res.status(201).json(created);
});

commandesRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [commande] = await db
    .select()
    .from(commandesTable)
    .where(and(eq(commandesTable.id, req.params.id), eq(commandesTable.licenceId, licenceId)))
    .limit(1);

  if (!commande) {
    res.status(404).json({ error: "Commande introuvable" });
    return;
  }
  res.json(commande);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
commandesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = commandeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantHt, tauxTva, ...rest } = parsed.data;
  const [updated] = await db
    .update(commandesTable)
    .set({
      ...rest,
      ...(montantHt !== undefined ? { montantHt: montantHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(commandesTable.id, req.params.id), eq(commandesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Commande introuvable" });
    return;
  }
  res.json(updated);
});

const TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["ENVOYEE"],
  ENVOYEE: ["CONFIRMEE"],
  CONFIRMEE: ["LIVREE"],
  LIVREE: [],
};

commandesRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ENVOYEE", "CONFIRMEE", "LIVREE"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [commande] = await db
    .select()
    .from(commandesTable)
    .where(and(eq(commandesTable.id, req.params.id), eq(commandesTable.licenceId, licenceId)))
    .limit(1);
  if (!commande) {
    res.status(404).json({ error: "Commande introuvable" });
    return;
  }

  if (!TRANSITIONS[commande.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${commande.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const [updated] = await db
    .update(commandesTable)
    .set({ statut: parsed.data.statut, updatedAt: new Date() })
    .where(and(eq(commandesTable.id, req.params.id), eq(commandesTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});
