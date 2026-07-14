import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, bilanCarboneTable, materiauxIniesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const bilanCarboneRouter = Router();
bilanCarboneRouter.use(requireModuleAccess("bilanCarbone"));

// Bibliotheque de reference (base INIES/ADEME, ordres de grandeur officiels)
// utilisee pour amorcer materiaux_inies a la premiere consultation d'une
// licence — evite une etape de seed separee tout en restant additif (la
// licence peut ensuite ajouter/modifier ses propres materiaux librement).
const INIES_SEED: {
  designation: string;
  categorie: string;
  sousCategorie: string;
  uniteFonctionnelle: string;
  emissionCo2Kg: string;
  dureeVieAns: number;
  densiteKgM3: string | null;
}[] = [
  { designation: "Beton pret a l'emploi C25/30", categorie: "gros_oeuvre", sousCategorie: "beton", uniteFonctionnelle: "m3", emissionCo2Kg: "271.0000", dureeVieAns: 100, densiteKgM3: "2350.00" },
  { designation: "Beton pret a l'emploi C30/37", categorie: "gros_oeuvre", sousCategorie: "beton", uniteFonctionnelle: "m3", emissionCo2Kg: "295.0000", dureeVieAns: 100, densiteKgM3: "2400.00" },
  { designation: "Beton bas carbone CEM III C25/30", categorie: "gros_oeuvre", sousCategorie: "beton", uniteFonctionnelle: "m3", emissionCo2Kg: "195.0000", dureeVieAns: 100, densiteKgM3: "2350.00" },
  { designation: "Acier armature HA", categorie: "gros_oeuvre", sousCategorie: "acier", uniteFonctionnelle: "kg", emissionCo2Kg: "2.4500", dureeVieAns: 100, densiteKgM3: "7850.00" },
  { designation: "Acier de construction S235", categorie: "gros_oeuvre", sousCategorie: "acier", uniteFonctionnelle: "kg", emissionCo2Kg: "2.7600", dureeVieAns: 100, densiteKgM3: "7850.00" },
  { designation: "Acier recycle", categorie: "gros_oeuvre", sousCategorie: "acier", uniteFonctionnelle: "kg", emissionCo2Kg: "0.8400", dureeVieAns: 100, densiteKgM3: "7850.00" },
  { designation: "Parpaing creux 20x20x50", categorie: "gros_oeuvre", sousCategorie: "maconnerie", uniteFonctionnelle: "unite", emissionCo2Kg: "7.2000", dureeVieAns: 100, densiteKgM3: null },
  { designation: "Brique terre cuite 20cm", categorie: "gros_oeuvre", sousCategorie: "maconnerie", uniteFonctionnelle: "m2", emissionCo2Kg: "42.5000", dureeVieAns: 100, densiteKgM3: null },
  { designation: "Laine de verre 120mm (R=3.75)", categorie: "isolation", sousCategorie: "laine_minerale", uniteFonctionnelle: "m2", emissionCo2Kg: "4.8000", dureeVieAns: 50, densiteKgM3: "18.00" },
  { designation: "Laine de roche 140mm (R=4.0)", categorie: "isolation", sousCategorie: "laine_minerale", uniteFonctionnelle: "m2", emissionCo2Kg: "8.1000", dureeVieAns: 50, densiteKgM3: "40.00" },
  { designation: "Polystyrene expanse (PSE) 100mm", categorie: "isolation", sousCategorie: "plastique", uniteFonctionnelle: "m2", emissionCo2Kg: "12.6000", dureeVieAns: 50, densiteKgM3: "20.00" },
  { designation: "Polyurethane projete 80mm", categorie: "isolation", sousCategorie: "plastique", uniteFonctionnelle: "m2", emissionCo2Kg: "18.3000", dureeVieAns: 50, densiteKgM3: "35.00" },
  { designation: "Ouate de cellulose 200mm", categorie: "isolation", sousCategorie: "biosource", uniteFonctionnelle: "m2", emissionCo2Kg: "1.2000", dureeVieAns: 50, densiteKgM3: "45.00" },
  { designation: "Fibre de bois 160mm", categorie: "isolation", sousCategorie: "biosource", uniteFonctionnelle: "m2", emissionCo2Kg: "2.5000", dureeVieAns: 50, densiteKgM3: "55.00" },
  { designation: "Fenetre PVC double vitrage", categorie: "menuiserie", sousCategorie: "fenetre", uniteFonctionnelle: "m2", emissionCo2Kg: "85.0000", dureeVieAns: 30, densiteKgM3: null },
  { designation: "Fenetre aluminium double vitrage", categorie: "menuiserie", sousCategorie: "fenetre", uniteFonctionnelle: "m2", emissionCo2Kg: "142.0000", dureeVieAns: 30, densiteKgM3: null },
  { designation: "Fenetre bois double vitrage", categorie: "menuiserie", sousCategorie: "fenetre", uniteFonctionnelle: "m2", emissionCo2Kg: "48.0000", dureeVieAns: 30, densiteKgM3: null },
  { designation: "Plaque de platre BA13 standard", categorie: "second_oeuvre", sousCategorie: "platrerie", uniteFonctionnelle: "m2", emissionCo2Kg: "3.8000", dureeVieAns: 50, densiteKgM3: null },
  { designation: "Carrelage gres cerame", categorie: "second_oeuvre", sousCategorie: "revetement_sol", uniteFonctionnelle: "m2", emissionCo2Kg: "22.0000", dureeVieAns: 50, densiteKgM3: null },
  { designation: "Parquet chene massif", categorie: "second_oeuvre", sousCategorie: "revetement_sol", uniteFonctionnelle: "m2", emissionCo2Kg: "8.5000", dureeVieAns: 50, densiteKgM3: null },
  { designation: "Ciment Portland CEM I", categorie: "gros_oeuvre", sousCategorie: "liant", uniteFonctionnelle: "kg", emissionCo2Kg: "0.8660", dureeVieAns: 100, densiteKgM3: "1500.00" },
  { designation: "Ciment bas carbone CEM III", categorie: "gros_oeuvre", sousCategorie: "liant", uniteFonctionnelle: "kg", emissionCo2Kg: "0.4100", dureeVieAns: 100, densiteKgM3: "1500.00" },
  { designation: "Bois lamelle-colle (resineux)", categorie: "gros_oeuvre", sousCategorie: "bois", uniteFonctionnelle: "m3", emissionCo2Kg: "-458.0000", dureeVieAns: 100, densiteKgM3: "450.00" },
  { designation: "Bois CLT (panneau massif)", categorie: "gros_oeuvre", sousCategorie: "bois", uniteFonctionnelle: "m3", emissionCo2Kg: "-510.0000", dureeVieAns: 100, densiteKgM3: "470.00" },
  { designation: "Tuile terre cuite", categorie: "couverture", sousCategorie: "tuile", uniteFonctionnelle: "m2", emissionCo2Kg: "31.0000", dureeVieAns: 50, densiteKgM3: null },
  { designation: "Ardoise naturelle", categorie: "couverture", sousCategorie: "ardoise", uniteFonctionnelle: "m2", emissionCo2Kg: "12.0000", dureeVieAns: 60, densiteKgM3: null },
  { designation: "Bac acier prelaque", categorie: "couverture", sousCategorie: "metal", uniteFonctionnelle: "m2", emissionCo2Kg: "24.5000", dureeVieAns: 40, densiteKgM3: null },
  { designation: "Cuivre tuyau sanitaire", categorie: "plomberie", sousCategorie: "tuyauterie", uniteFonctionnelle: "kg", emissionCo2Kg: "3.7100", dureeVieAns: 50, densiteKgM3: "8900.00" },
  { designation: "PVC tuyau evacuation", categorie: "plomberie", sousCategorie: "tuyauterie", uniteFonctionnelle: "kg", emissionCo2Kg: "3.1000", dureeVieAns: 50, densiteKgM3: "1400.00" },
  { designation: "Cable electrique cuivre 2.5mm2", categorie: "electricite", sousCategorie: "cable", uniteFonctionnelle: "ml", emissionCo2Kg: "0.5200", dureeVieAns: 50, densiteKgM3: null },
];

const bilanInputSchema = z.object({
  projectId: z.string().uuid(),
  categorie: z.enum(["TRANSPORT", "MATERIAUX", "ENERGIE", "DECHETS", "AUTRE"]),
  materiauIniesId: z.string().uuid().optional(),
  poste: z.string().min(1).max(300),
  quantite: z.number().positive(),
  unite: z.string().min(1).max(20),
  facteurEmissionKgCo2: z.number().nonnegative(),
  dateOperation: z.string(),
  notes: z.string().optional(),
});

const bilanUpdateSchema = bilanInputSchema.partial().extend({
  active: z.boolean().optional(),
});

const materiauIniesInputSchema = z.object({
  codeInies: z.string().max(50).optional(),
  designation: z.string().min(1).max(300),
  categorie: z.string().min(1).max(50),
  sousCategorie: z.string().max(50).optional(),
  uniteFonctionnelle: z.string().min(1).max(20),
  emissionCo2Kg: z.number(),
  source: z.string().max(50).optional(),
  dureeVieAns: z.number().int().positive().optional(),
  densiteKgM3: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
});

// Bibliotheque de materiaux (facteurs d'emission de reference). Montee sous
// le meme routeur/module RBAC que les lignes de bilan carbone : c'est un
// outil de saisie pour ce module, pas une ressource independante.
bilanCarboneRouter.get("/materiaux-inies", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  let materiaux = await db
    .select()
    .from(materiauxIniesTable)
    .where(and(eq(materiauxIniesTable.licenceId, licenceId), eq(materiauxIniesTable.active, true)));

  // Amorcage a la premiere consultation de cette licence — additif, aucune
  // donnee existante n'est jamais touchee (voir CLAUDE.md regle migrations).
  if (materiaux.length === 0) {
    await db.insert(materiauxIniesTable).values(
      INIES_SEED.map((m) => ({ licenceId, ...m, dureeVieAns: m.dureeVieAns })),
    );
    materiaux = await db
      .select()
      .from(materiauxIniesTable)
      .where(and(eq(materiauxIniesTable.licenceId, licenceId), eq(materiauxIniesTable.active, true)));
  }

  res.json(materiaux);
});

bilanCarboneRouter.post("/materiaux-inies", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = materiauIniesInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { emissionCo2Kg, densiteKgM3, ...rest } = parsed.data;
  const [created] = await db
    .insert(materiauxIniesTable)
    .values({
      licenceId,
      ...rest,
      emissionCo2Kg: emissionCo2Kg.toString(),
      densiteKgM3: densiteKgM3?.toString(),
    })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false }.
bilanCarboneRouter.patch("/materiaux-inies/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = materiauIniesInputSchema.partial().extend({ active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(materiauxIniesTable)
    .where(and(eq(materiauxIniesTable.id, req.params.id), eq(materiauxIniesTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Materiau introuvable" });
    return;
  }

  const { emissionCo2Kg, densiteKgM3, ...rest } = parsed.data;
  const [updated] = await db
    .update(materiauxIniesTable)
    .set({
      ...rest,
      ...(emissionCo2Kg !== undefined ? { emissionCo2Kg: emissionCo2Kg.toString() } : {}),
      ...(densiteKgM3 !== undefined ? { densiteKgM3: densiteKgM3.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(materiauxIniesTable.id, existing.id))
    .returning();
  res.json(updated);
});

bilanCarboneRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const { projectId } = req.query;
  const conditions = [eq(bilanCarboneTable.licenceId, licenceId), eq(bilanCarboneTable.active, true)];
  if (typeof projectId === "string") conditions.push(eq(bilanCarboneTable.projectId, projectId));

  const rows = await db
    .select()
    .from(bilanCarboneTable)
    .where(and(...conditions));
  res.json(rows);
});

// emissionsKgCo2 est toujours calcule et fige serveur-side (jamais confie au
// client) : quantite x facteurEmissionKgCo2 au moment de la saisie.
bilanCarboneRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = bilanInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { quantite, materiauIniesId, ...rest } = parsed.data;
  let { poste, unite, facteurEmissionKgCo2 } = rest;

  // Si un materiau de bibliotheque est reference, ses valeurs font foi (le
  // client peut les afficher/pre-remplir mais ne peut pas les falsifier) —
  // meme logique que emissionsKgCo2, jamais confie au client.
  if (materiauIniesId) {
    const [materiau] = await db
      .select()
      .from(materiauxIniesTable)
      .where(and(eq(materiauxIniesTable.id, materiauIniesId), eq(materiauxIniesTable.licenceId, licenceId)))
      .limit(1);
    if (!materiau) {
      res.status(400).json({ error: "Materiau de bibliotheque introuvable" });
      return;
    }
    poste = materiau.designation;
    unite = materiau.uniteFonctionnelle;
    facteurEmissionKgCo2 = Number(materiau.emissionCo2Kg);
  }

  const emissionsKgCo2 = quantite * facteurEmissionKgCo2;

  const [created] = await db
    .insert(bilanCarboneTable)
    .values({
      licenceId,
      ...rest,
      materiauIniesId,
      poste,
      unite,
      quantite: quantite.toString(),
      facteurEmissionKgCo2: facteurEmissionKgCo2.toString(),
      emissionsKgCo2: emissionsKgCo2.toString(),
    })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
bilanCarboneRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = bilanUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(bilanCarboneTable)
    .where(and(eq(bilanCarboneTable.id, req.params.id), eq(bilanCarboneTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Ligne de bilan carbone introuvable" });
    return;
  }

  const { quantite, facteurEmissionKgCo2, active, ...rest } = parsed.data;
  const nextQuantite = quantite ?? Number(existing.quantite);
  const nextFacteur = facteurEmissionKgCo2 ?? Number(existing.facteurEmissionKgCo2);
  const recalcule = quantite !== undefined || facteurEmissionKgCo2 !== undefined;

  const [updated] = await db
    .update(bilanCarboneTable)
    .set({
      ...rest,
      ...(quantite !== undefined ? { quantite: quantite.toString() } : {}),
      ...(facteurEmissionKgCo2 !== undefined ? { facteurEmissionKgCo2: facteurEmissionKgCo2.toString() } : {}),
      ...(recalcule ? { emissionsKgCo2: (nextQuantite * nextFacteur).toString() } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bilanCarboneTable.id, existing.id))
    .returning();
  res.json(updated);
});
