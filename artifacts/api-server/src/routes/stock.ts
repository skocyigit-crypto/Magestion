import { Router } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, stockItemsTable, stockMovementsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const stockRouter = Router();

const stockItemInputSchema = z.object({
  nom: z.string().min(1).max(200),
  categorie: z.string().max(100).optional(),
  unite: z.string().min(1).max(20).optional(),
  seuilAlerte: z.number().nonnegative().optional(),
  prixUnitaireHt: z.number().nonnegative().optional(),
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

const mouvementInputSchema = z.object({
  type: z.enum(["ENTREE", "SORTIE"]),
  quantite: z.number().positive(),
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

  const [item] = await db
    .select()
    .from(stockItemsTable)
    .where(and(eq(stockItemsTable.id, req.params.id), eq(stockItemsTable.licenceId, licenceId)))
    .limit(1);
  if (!item) {
    res.status(404).json({ error: "Article de stock introuvable" });
    return;
  }

  const delta = parsed.data.type === "ENTREE" ? parsed.data.quantite : -parsed.data.quantite;
  const nouvelleQuantite = Number(item.quantiteActuelle) + delta;
  if (nouvelleQuantite < 0) {
    res.status(409).json({ error: "Stock insuffisant pour cette sortie" });
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

  await db
    .update(stockItemsTable)
    .set({ quantiteActuelle: sql`${stockItemsTable.quantiteActuelle} + ${delta}`, updatedAt: new Date() })
    .where(eq(stockItemsTable.id, item.id));

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
