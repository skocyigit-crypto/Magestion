import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, depensesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { recordDepenseReception } from "../lib/journalEntry.js";

export const depensesRouter = Router();
depensesRouter.use(requireModuleAccess("depenses"));

const categorieEnum = z.enum(["MATERIAUX", "MAIN_OEUVRE", "SOUS_TRAITANCE", "MATERIEL", "ADMINISTRATIF", "AUTRE"]);

const depenseInputSchema = z.object({
  fournisseur: z.string().min(1).max(200),
  fournisseurId: z.string().uuid().optional(),
  objet: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
  categorie: categorieEnum.optional(),
  montantHt: z.number().nonnegative().max(9999999999.99),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  dateEcheance: z.string().optional(),
  autoliquidation: z.boolean().optional(),
});

const depenseUpdateSchema = depenseInputSchema.partial().extend({
  active: z.boolean().optional(),
});

depensesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(depensesTable)
    .where(and(eq(depensesTable.licenceId, licenceId), eq(depensesTable.active, !onlyInactive)));

  res.json(rows);
});

depensesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = depenseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(depensesTable)
    .values({
      licenceId,
      fournisseur: parsed.data.fournisseur,
      fournisseurId: parsed.data.fournisseurId,
      objet: parsed.data.objet,
      projectId: parsed.data.projectId,
      categorie: parsed.data.categorie,
      montantHt: parsed.data.montantHt.toString(),
      tauxTva: parsed.data.tauxTva.toString(),
      dateEcheance: parsed.data.dateEcheance,
      autoliquidation: parsed.data.autoliquidation ?? false,
    })
    .returning();

  // Ecriture AC generee a la reception (fait comptable = facture recue, pas
  // le paiement) — voir lib/journalEntry.ts pour le detail du double mouvement
  // N8 en cas d'autoliquidation.
  await recordDepenseReception({
    licenceId,
    depenseId: created.id,
    fournisseur: created.fournisseur,
    categorie: created.categorie,
    montantHt: Number(created.montantHt),
    tauxTva: Number(created.tauxTva),
    autoliquidation: created.autoliquidation,
  });

  res.status(201).json(created);
});

depensesRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [depense] = await db
    .select()
    .from(depensesTable)
    .where(and(eq(depensesTable.id, req.params.id), eq(depensesTable.licenceId, licenceId)))
    .limit(1);

  if (!depense) {
    res.status(404).json({ error: "Depense introuvable" });
    return;
  }
  res.json(depense);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
depensesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = depenseUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantHt, tauxTva, ...rest } = parsed.data;
  const [updated] = await db
    .update(depensesTable)
    .set({
      ...rest,
      ...(montantHt !== undefined ? { montantHt: montantHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(depensesTable.id, req.params.id), eq(depensesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Depense introuvable" });
    return;
  }
  res.json(updated);
});

const TRANSITIONS: Record<string, string[]> = {
  A_VALIDER: ["BON_A_PAYER", "EN_LITIGE"],
  BON_A_PAYER: ["PAYEE", "EN_LITIGE"],
  EN_LITIGE: ["BON_A_PAYER"],
  PAYEE: [],
};

depensesRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["BON_A_PAYER", "PAYEE", "EN_LITIGE"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [depense] = await db
    .select()
    .from(depensesTable)
    .where(and(eq(depensesTable.id, req.params.id), eq(depensesTable.licenceId, licenceId)))
    .limit(1);
  if (!depense) {
    res.status(404).json({ error: "Depense introuvable" });
    return;
  }

  if (!TRANSITIONS[depense.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${depense.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(depensesTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "PAYEE" ? { datePaiement: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(depensesTable.id, req.params.id), eq(depensesTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});
