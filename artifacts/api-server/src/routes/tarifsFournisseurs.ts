import { Router } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, tarifsFournisseursTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const tarifsFournisseursRouter = Router();
tarifsFournisseursRouter.use(requireModuleAccess("fournisseurs"));

const tarifInputSchema = z.object({
  fournisseurId: z.string().uuid(),
  articleId: z.string().uuid(),
  prixUnitaireHt: z.number().nonnegative(),
  referenceFournisseur: z.string().max(200).optional(),
  delaiLivraisonJours: z.number().int().nonnegative().optional(),
  dateValidite: z.string().optional(),
});

const tarifUpdateSchema = z.object({
  prixUnitaireHt: z.number().nonnegative().optional(),
  referenceFournisseur: z.string().max(200).optional(),
  delaiLivraisonJours: z.number().int().nonnegative().optional(),
  dateValidite: z.string().optional(),
  active: z.boolean().optional(),
});

// Tries par prix croissant : la premiere ligne est le meilleur fournisseur
// pour l'article demande (voir usage cote page Articles).
tarifsFournisseursRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { articleId, fournisseurId } = req.query;
  const conditions = [eq(tarifsFournisseursTable.licenceId, licenceId), eq(tarifsFournisseursTable.active, true)];
  if (typeof articleId === "string") conditions.push(eq(tarifsFournisseursTable.articleId, articleId));
  if (typeof fournisseurId === "string") conditions.push(eq(tarifsFournisseursTable.fournisseurId, fournisseurId));

  const rows = await db
    .select()
    .from(tarifsFournisseursTable)
    .where(and(...conditions))
    .orderBy(asc(tarifsFournisseursTable.prixUnitaireHt));
  res.json(rows);
});

// Met a jour le tarif existant si (fournisseur, article) est deja tarife —
// un seul prix courant par couple, pas d'historique empile (voir schema).
tarifsFournisseursRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = tarifInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { prixUnitaireHt, fournisseurId, articleId, ...rest } = parsed.data;

  const [existing] = await db
    .select()
    .from(tarifsFournisseursTable)
    .where(
      and(
        eq(tarifsFournisseursTable.licenceId, licenceId),
        eq(tarifsFournisseursTable.fournisseurId, fournisseurId),
        eq(tarifsFournisseursTable.articleId, articleId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(tarifsFournisseursTable)
      .set({ ...rest, prixUnitaireHt: prixUnitaireHt.toString(), active: true, updatedAt: new Date() })
      .where(eq(tarifsFournisseursTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db
    .insert(tarifsFournisseursTable)
    .values({ licenceId, fournisseurId, articleId, ...rest, prixUnitaireHt: prixUnitaireHt.toString() })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
tarifsFournisseursRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = tarifUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { prixUnitaireHt, ...rest } = parsed.data;
  const [updated] = await db
    .update(tarifsFournisseursTable)
    .set({ ...rest, ...(prixUnitaireHt !== undefined ? { prixUnitaireHt: prixUnitaireHt.toString() } : {}), updatedAt: new Date() })
    .where(and(eq(tarifsFournisseursTable.id, req.params.id), eq(tarifsFournisseursTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Tarif introuvable" });
    return;
  }
  res.json(updated);
});
