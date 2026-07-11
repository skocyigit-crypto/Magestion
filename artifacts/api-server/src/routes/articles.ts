import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, articlesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const articlesRouter = Router();

const CATEGORIE_ENUM = z.enum(["FOURNITURE", "MAIN_OEUVRE", "MATERIEL", "SOUS_TRAITANCE", "DIVERS"]);

const articleInputSchema = z.object({
  code: z.string().min(1).max(50),
  libelle: z.string().min(1).max(300),
  unite: z.string().min(1).max(20).optional(),
  categorie: CATEGORIE_ENUM.optional(),
  prixUnitaireHt: z.number().nonnegative(),
});

articlesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(articlesTable)
    .where(and(eq(articlesTable.licenceId, licenceId), eq(articlesTable.active, !onlyInactive)));

  res.json(rows);
});

articlesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = articleInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(articlesTable)
    .values({
      licenceId,
      code: parsed.data.code,
      libelle: parsed.data.libelle,
      unite: parsed.data.unite,
      categorie: parsed.data.categorie,
      prixUnitaireHt: parsed.data.prixUnitaireHt.toString(),
    })
    .returning();

  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
articlesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = articleInputSchema.partial().extend({ active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { prixUnitaireHt, ...rest } = parsed.data;
  const [updated] = await db
    .update(articlesTable)
    .set({
      ...rest,
      ...(prixUnitaireHt !== undefined ? { prixUnitaireHt: prixUnitaireHt.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(articlesTable.id, req.params.id), eq(articlesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Article introuvable" });
    return;
  }
  res.json(updated);
});
