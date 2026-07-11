import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, articlesTable, ouvrageArticlesTable, ouvragesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const ouvragesRouter = Router();
ouvragesRouter.use(requireModuleAccess("ouvrages"));

const compositionLineSchema = z.object({ articleId: z.string().uuid(), quantite: z.number().positive() });

const ouvrageInputSchema = z.object({
  code: z.string().min(1).max(50),
  libelle: z.string().min(1).max(300),
  unite: z.string().min(1).max(20).optional(),
  coefficientK: z.number().min(1).max(3).optional(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  composition: z.array(compositionLineSchema).min(1),
});

ouvragesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(ouvragesTable)
    .where(and(eq(ouvragesTable.licenceId, licenceId), eq(ouvragesTable.active, !onlyInactive)));

  res.json(rows);
});

// Le debourse sec ET le prix de vente sont TOUJOURS deriveS server-side de la
// composition — jamais acceptes du client (voir commentaire schema/ouvrages.ts,
// c'est exactement le bug corrige par rapport au projet de reference).
async function computeDebourseSec(licenceId: string, composition: { articleId: string; quantite: number }[]) {
  const articleIds = composition.map((c) => c.articleId);
  const articles = await db
    .select()
    .from(articlesTable)
    .where(and(inArray(articlesTable.id, articleIds), eq(articlesTable.licenceId, licenceId)));

  if (articles.length !== new Set(articleIds).size) {
    throw new Error("Un ou plusieurs articles de la composition sont introuvables");
  }

  const prixParArticle = new Map(articles.map((a) => [a.id, Number(a.prixUnitaireHt)]));
  return composition.reduce((sum, line) => sum + (prixParArticle.get(line.articleId) ?? 0) * line.quantite, 0);
}

ouvragesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = ouvrageInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  let debourseSecHt: number;
  try {
    debourseSecHt = await computeDebourseSec(licenceId, parsed.data.composition);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Composition invalide" });
    return;
  }

  const coefficientK = parsed.data.coefficientK ?? 1.3;
  const prixVenteHt = debourseSecHt * coefficientK;

  const [created] = await db
    .insert(ouvragesTable)
    .values({
      licenceId,
      code: parsed.data.code,
      libelle: parsed.data.libelle,
      unite: parsed.data.unite,
      coefficientK: coefficientK.toString(),
      debourseSecHt: debourseSecHt.toString(),
      prixVenteHt: prixVenteHt.toString(),
      tauxTva: parsed.data.tauxTva?.toString(),
    })
    .returning();

  await db.insert(ouvrageArticlesTable).values(
    parsed.data.composition.map((line, i) => ({
      ouvrageId: created.id,
      articleId: line.articleId,
      quantite: line.quantite.toString(),
      ordre: i,
    })),
  );

  res.status(201).json(created);
});

const ouvrageUpdateSchema = ouvrageInputSchema.partial().extend({ active: z.boolean().optional() });

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// Si "composition" est fournie, le debourse sec et le prix de vente sont
// re-derives server-side (jamais acceptes du client), memes garanties qu'a la creation.
ouvragesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = ouvrageUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(ouvragesTable)
    .where(and(eq(ouvragesTable.id, req.params.id), eq(ouvragesTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Ouvrage introuvable" });
    return;
  }

  const { composition, coefficientK, code, libelle, unite, tauxTva, active } = parsed.data;

  let debourseSecHt: number | undefined;
  let prixVenteHt: number | undefined;
  const effectiveCoefficientK = coefficientK ?? Number(existing.coefficientK);

  if (composition) {
    try {
      debourseSecHt = await computeDebourseSec(licenceId, composition);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Composition invalide" });
      return;
    }
    prixVenteHt = debourseSecHt * effectiveCoefficientK;
  } else if (coefficientK !== undefined) {
    debourseSecHt = Number(existing.debourseSecHt);
    prixVenteHt = debourseSecHt * effectiveCoefficientK;
  }

  const [updated] = await db
    .update(ouvragesTable)
    .set({
      ...(code !== undefined ? { code } : {}),
      ...(libelle !== undefined ? { libelle } : {}),
      ...(unite !== undefined ? { unite } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(coefficientK !== undefined ? { coefficientK: coefficientK.toString() } : {}),
      ...(debourseSecHt !== undefined ? { debourseSecHt: debourseSecHt.toString() } : {}),
      ...(prixVenteHt !== undefined ? { prixVenteHt: prixVenteHt.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(ouvragesTable.id, req.params.id), eq(ouvragesTable.licenceId, licenceId)))
    .returning();

  if (composition) {
    await db.delete(ouvrageArticlesTable).where(eq(ouvrageArticlesTable.ouvrageId, req.params.id));
    await db.insert(ouvrageArticlesTable).values(
      composition.map((line, i) => ({
        ouvrageId: req.params.id,
        articleId: line.articleId,
        quantite: line.quantite.toString(),
        ordre: i,
      })),
    );
  }

  res.json(updated);
});

ouvragesRouter.get("/:id/composition", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [ouvrage] = await db
    .select()
    .from(ouvragesTable)
    .where(and(eq(ouvragesTable.id, req.params.id), eq(ouvragesTable.licenceId, licenceId)))
    .limit(1);
  if (!ouvrage) {
    res.status(404).json({ error: "Ouvrage introuvable" });
    return;
  }

  const rows = await db
    .select({
      id: ouvrageArticlesTable.id,
      articleId: ouvrageArticlesTable.articleId,
      quantite: ouvrageArticlesTable.quantite,
      code: articlesTable.code,
      libelle: articlesTable.libelle,
      unite: articlesTable.unite,
      prixUnitaireHt: articlesTable.prixUnitaireHt,
    })
    .from(ouvrageArticlesTable)
    .innerJoin(articlesTable, eq(ouvrageArticlesTable.articleId, articlesTable.id))
    .where(eq(ouvrageArticlesTable.ouvrageId, req.params.id))
    .orderBy(ouvrageArticlesTable.ordre);

  res.json(rows);
});
