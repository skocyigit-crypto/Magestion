import { Router } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, stockItemsTable, stockMovementsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const stockRouter = Router();
stockRouter.use(requireModuleAccess("stock"));

const stockItemInputSchema = z.object({
  nom: z.string().min(1).max(200),
  categorie: z.string().max(100).optional(),
  unite: z.string().min(1).max(20).optional(),
  seuilAlerte: z.number().nonnegative().max(99999999.99).optional(),
  prixUnitaireHt: z.number().nonnegative().max(99999999.99).optional(),
});

stockRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(stockItemsTable)
    .where(and(eq(stockItemsTable.licenceId, licenceId), eq(stockItemsTable.active, !onlyInactive)));

  const withAlert = rows.map((r) => ({ ...r, enAlerte: Number(r.quantiteActuelle) <= Number(r.seuilAlerte) }));
  res.json(withAlert);
});

stockRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = stockItemInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(stockItemsTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      categorie: parsed.data.categorie,
      unite: parsed.data.unite,
      seuilAlerte: parsed.data.seuilAlerte?.toString(),
      prixUnitaireHt: parsed.data.prixUnitaireHt?.toString(),
    })
    .returning();

  res.status(201).json(created);
});

const stockItemUpdateSchema = stockItemInputSchema.partial().extend({ active: z.boolean().optional() });

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// La quantiteActuelle n'est jamais modifiable directement ici — uniquement via
// /mouvements (ENTREE/SORTIE), pour garder un historique coherent des stocks.
stockRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = stockItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { seuilAlerte, prixUnitaireHt, ...rest } = parsed.data;
  const [updated] = await db
    .update(stockItemsTable)
    .set({
      ...rest,
      ...(seuilAlerte !== undefined ? { seuilAlerte: seuilAlerte.toString() } : {}),
      ...(prixUnitaireHt !== undefined ? { prixUnitaireHt: prixUnitaireHt.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(stockItemsTable.id, req.params.id), eq(stockItemsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Article de stock introuvable" });
    return;
  }
  res.json(updated);
});

const mouvementInputSchema = z.object({
  type: z.enum(["ENTREE", "SORTIE"]),
  quantite: z.number().positive().max(99999999.99),
  motif: z.string().max(500).optional(),
  projectId: z.string().uuid().optional(),
});

stockRouter.post("/:id/mouvements", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = mouvementInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const delta = parsed.data.type === "ENTREE" ? parsed.data.quantite : -parsed.data.quantite;

  // Update conditionnel et atomique : la condition de non-negativite est
  // verifiee par la base au moment meme de l'ecriture (WHERE), pas sur une
  // lecture prealable — deux sorties concurrentes ne peuvent plus toutes les
  // deux lire un stock suffisant puis faire passer la quantite en negatif.
  const [item] = await db
    .update(stockItemsTable)
    .set({ quantiteActuelle: sql`${stockItemsTable.quantiteActuelle} + ${delta}`, updatedAt: new Date() })
    .where(
      and(
        eq(stockItemsTable.id, req.params.id),
        eq(stockItemsTable.licenceId, licenceId),
        sql`${stockItemsTable.quantiteActuelle} + ${delta} >= 0`,
      ),
    )
    .returning();

  if (!item) {
    const [exists] = await db
      .select({ id: stockItemsTable.id })
      .from(stockItemsTable)
      .where(and(eq(stockItemsTable.id, req.params.id), eq(stockItemsTable.licenceId, licenceId)))
      .limit(1);
    if (!exists) {
      res.status(404).json({ error: "Article de stock introuvable" });
    } else {
      res.status(409).json({ error: "Stock insuffisant pour cette sortie" });
    }
    return;
  }

  const [movement] = await db
    .insert(stockMovementsTable)
    .values({
      licenceId,
      stockItemId: item.id,
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      quantite: parsed.data.quantite.toString(),
      motif: parsed.data.motif,
    })
    .returning();

  res.status(201).json(movement);
});

stockRouter.get("/:id/mouvements", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(stockMovementsTable)
    .where(and(eq(stockMovementsTable.stockItemId, req.params.id), eq(stockMovementsTable.licenceId, licenceId)));

  res.json(rows);
});
