import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, etapesClotureTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const clotureComptableRouter = Router();
clotureComptableRouter.use(requireModuleAccess("comptabilite"));

// Checklist standard adaptee au perimetre Magestion (BTP) — chaque etape
// obligatoire doit passer a FAIT avant de considerer l'exercice clos ; les
// etapes non automatisees dans l'app (provisions, CCA/PCA...) restent des
// rappels de discipline comptable, pas des actions declenchees ici.
const ETAPES_DEFAUT: { ordre: number; titre: string; description: string; obligatoire: boolean }[] = [
  { ordre: 1, titre: "Rapprochement bancaire complet", description: "Verifier que tous les mouvements bancaires de l'exercice sont rapproches (voir Rapprochement bancaire).", obligatoire: true },
  { ordre: 2, titre: "Lettrage des comptes tiers", description: "Lettrer les comptes clients (411) et fournisseurs (401) — identifier les soldes ouverts restants (voir Comptabilite > Lettrage).", obligatoire: true },
  { ordre: 3, titre: "Inventaire physique du stock", description: "Verifier les quantites reelles en stock face aux quantites theoriques et ajuster si necessaire (voir Stock).", obligatoire: true },
  { ordre: 4, titre: "Provisions pour risques et charges", description: "Constituer les provisions pour litiges, garanties decennales, chantiers a risque.", obligatoire: true },
  { ordre: 5, titre: "Charges constatees d'avance (CCA)", description: "Identifier les charges payees sur l'exercice mais concernant l'exercice suivant.", obligatoire: false },
  { ordre: 6, titre: "Produits constates d'avance (PCA)", description: "Identifier les produits factures sur l'exercice mais concernant l'exercice suivant.", obligatoire: false },
  { ordre: 7, titre: "Factures non parvenues (FNP)", description: "Estimer les prestations recues avant cloture mais non encore facturees par le fournisseur.", obligatoire: true },
  { ordre: 8, titre: "Valorisation des travaux en cours", description: "Verifier l'avancement declare de chaque situation de travaux non soldee (voir Situations).", obligatoire: true },
  { ordre: 9, titre: "Declaration TVA de regularisation", description: "Etablir la derniere declaration TVA de l'exercice avec les ajustements de cloture (voir Comptabilite > Declarations TVA).", obligatoire: true },
  { ordre: 10, titre: "Verification de la balance generale", description: "S'assurer que le total des debits egale le total des credits sur l'exercice.", obligatoire: true },
  { ordre: 11, titre: "Export FEC de l'exercice", description: "Generer et archiver le Fichier des Ecritures Comptables de l'exercice clos (voir Comptabilite > Export FEC).", obligatoire: true },
  { ordre: 12, titre: "Verrouillage de l'exercice", description: "Confirmer qu'aucune ecriture supplementaire ne sera necessaire sur cet exercice.", obligatoire: true },
];

async function ensureEtapes(licenceId: string, exercice: string) {
  let etapes = await db
    .select()
    .from(etapesClotureTable)
    .where(and(eq(etapesClotureTable.licenceId, licenceId), eq(etapesClotureTable.exercice, exercice)))
    .orderBy(asc(etapesClotureTable.ordre));

  if (etapes.length === 0) {
    const inserted = await db
      .insert(etapesClotureTable)
      .values(ETAPES_DEFAUT.map((e) => ({ ...e, licenceId, exercice })))
      .returning();
    etapes = inserted.sort((a, b) => a.ordre - b.ordre);
  }

  return etapes;
}

clotureComptableRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const exercice = typeof req.query.exercice === "string" ? req.query.exercice : String(new Date().getFullYear());
  const etapes = await ensureEtapes(licenceId, exercice);
  res.json(etapes);
});

clotureComptableRouter.get("/stats", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const exercice = typeof req.query.exercice === "string" ? req.query.exercice : String(new Date().getFullYear());
  const etapes = await ensureEtapes(licenceId, exercice);

  const nbFait = etapes.filter((e) => e.statut === "FAIT").length;
  const nbEnCours = etapes.filter((e) => e.statut === "EN_COURS").length;
  const nbAFaire = etapes.filter((e) => e.statut === "A_FAIRE").length;
  const nbBloque = etapes.filter((e) => e.statut === "BLOQUE").length;
  const total = etapes.length;
  const obligatoiresNonTerminees = etapes.filter((e) => e.obligatoire && e.statut !== "FAIT");

  res.json({
    total,
    nbFait,
    nbEnCours,
    nbAFaire,
    nbBloque,
    progression: total > 0 ? Math.round((nbFait / total) * 100) : 0,
    prochaineEtape: obligatoiresNonTerminees.sort((a, b) => a.ordre - b.ordre)[0]?.titre ?? null,
    pretPourCloture: obligatoiresNonTerminees.length === 0,
  });
});

const STATUTS = ["A_FAIRE", "EN_COURS", "FAIT", "BLOQUE"] as const;
const updateSchema = z.object({
  statut: z.enum(STATUTS).optional(),
  notes: z.string().max(2000).optional(),
});

// Une etape FAIT ne peut revenir qu'a EN_COURS (jamais directement a
// A_FAIRE/BLOQUE) — evite un retour arriere accidentel qui masquerait une
// cloture deja realisee.
clotureComptableRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(etapesClotureTable)
    .where(and(eq(etapesClotureTable.id, req.params.id), eq(etapesClotureTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Etape introuvable" });
    return;
  }
  if (parsed.data.statut && existing.statut === "FAIT" && parsed.data.statut !== "EN_COURS") {
    res.status(409).json({ error: "Etape deja validee — seul le retour a 'EN_COURS' est autorise" });
    return;
  }

  const [updated] = await db
    .update(etapesClotureTable)
    .set({
      ...parsed.data,
      ...(parsed.data.statut === "FAIT" ? { dateRealisation: new Date() } : {}),
      ...(parsed.data.statut === "EN_COURS" || parsed.data.statut === "A_FAIRE" ? { dateRealisation: null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(etapesClotureTable.id, req.params.id), eq(etapesClotureTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

clotureComptableRouter.post("/reinitialiser", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ exercice: z.string().length(4) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const etapes = await ensureEtapes(licenceId, parsed.data.exercice);
  await db
    .update(etapesClotureTable)
    .set({ statut: "A_FAIRE", dateRealisation: null, notes: null, updatedAt: new Date() })
    .where(inArray(etapesClotureTable.id, etapes.map((e) => e.id)));

  const reset = await db
    .select()
    .from(etapesClotureTable)
    .where(and(eq(etapesClotureTable.licenceId, licenceId), eq(etapesClotureTable.exercice, parsed.data.exercice)))
    .orderBy(asc(etapesClotureTable.ordre));

  res.json(reset);
});
