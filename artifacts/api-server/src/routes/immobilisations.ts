import { Router } from "express";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db, immobilisationsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { amortissementAsOf, computeAmortissementPlan } from "../lib/amortissement.js";

export const immobilisationsRouter = Router();
immobilisationsRouter.use(requireModuleAccess("comptabilite"));

const CATEGORIE_ENUM = z.enum(["MATERIEL", "VEHICULE", "INFORMATIQUE", "MOBILIER", "OUTILLAGE", "AUTRE"]);
const STATUT_ENUM = z.enum(["EN_SERVICE", "CEDE", "REBUT"]);

function dateDebutAmort(immo: { dateMiseEnService: string | null; dateAcquisition: string }): Date {
  return new Date(immo.dateMiseEnService ?? immo.dateAcquisition);
}

// Ajoute le snapshot d'amortissement calcule (jamais stocke, voir schema) a
// chaque immobilisation renvoyee au client.
function withSnapshot<T extends { valeurAcquisition: string; dureeAmortissement: number; dateAcquisition: string; dateMiseEnService: string | null }>(immo: T) {
  const snapshot = amortissementAsOf({
    valeurAcquisition: Number(immo.valeurAcquisition),
    dureeAmortissement: immo.dureeAmortissement,
    dateDebut: dateDebutAmort(immo),
  });
  return { ...immo, ...snapshot };
}

immobilisationsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(immobilisationsTable)
    .where(and(eq(immobilisationsTable.licenceId, licenceId), eq(immobilisationsTable.active, !onlyInactive)));

  res.json(rows.map(withSnapshot));
});

immobilisationsRouter.get("/stats", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(immobilisationsTable)
    .where(and(eq(immobilisationsTable.licenceId, licenceId), eq(immobilisationsTable.active, true)));
  const withSnap = rows.map(withSnapshot);

  const parCategorie: Record<string, { count: number; valeur: number; vnc: number }> = {};
  for (const immo of withSnap) {
    const entry = parCategorie[immo.categorie] ?? { count: 0, valeur: 0, vnc: 0 };
    entry.count += 1;
    entry.valeur += Number(immo.valeurAcquisition);
    entry.vnc += immo.valeurNetteComptable;
    parCategorie[immo.categorie] = entry;
  }

  res.json({
    total: withSnap.length,
    totalAcquisition: withSnap.reduce((s, i) => s + Number(i.valeurAcquisition), 0),
    totalAmortCumule: withSnap.reduce((s, i) => s + i.amortissementCumule, 0),
    totalVNC: withSnap.reduce((s, i) => s + i.valeurNetteComptable, 0),
    totalDotation: withSnap.reduce((s, i) => s + i.dotationAnnuelle, 0),
    enService: withSnap.filter((i) => i.statut === "EN_SERVICE").length,
    cede: withSnap.filter((i) => i.statut === "CEDE").length,
    rebut: withSnap.filter((i) => i.statut === "REBUT").length,
    parCategorie,
  });
});

const immobilisationInputSchema = z.object({
  designation: z.string().min(1).max(300),
  categorie: CATEGORIE_ENUM.optional(),
  compteComptable: z.string().max(10).optional(),
  dateAcquisition: z.string(),
  dateMiseEnService: z.string().optional(),
  valeurAcquisition: z.number().nonnegative().max(999999999.99),
  dureeAmortissement: z.number().int().min(1).max(50).optional(),
  fournisseurId: z.string().uuid().optional(),
  localisation: z.string().max(300).optional(),
  affecteA: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

immobilisationsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = immobilisationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(immobilisationsTable)
    .where(eq(immobilisationsTable.licenceId, licenceId));
  const code = `IMM-${String(total + 1).padStart(4, "0")}`;

  const [created] = await db
    .insert(immobilisationsTable)
    .values({
      licenceId,
      code,
      designation: parsed.data.designation,
      categorie: parsed.data.categorie,
      compteComptable: parsed.data.compteComptable,
      dateAcquisition: parsed.data.dateAcquisition,
      dateMiseEnService: parsed.data.dateMiseEnService,
      valeurAcquisition: parsed.data.valeurAcquisition.toString(),
      dureeAmortissement: parsed.data.dureeAmortissement,
      fournisseurId: parsed.data.fournisseurId,
      localisation: parsed.data.localisation,
      affecteA: parsed.data.affecteA,
      notes: parsed.data.notes,
    })
    .returning();

  res.status(201).json(withSnapshot(created));
});

immobilisationsRouter.get("/:id/plan", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [immo] = await db
    .select()
    .from(immobilisationsTable)
    .where(and(eq(immobilisationsTable.id, req.params.id), eq(immobilisationsTable.licenceId, licenceId)))
    .limit(1);
  if (!immo) {
    res.status(404).json({ error: "Immobilisation introuvable" });
    return;
  }

  const plan = computeAmortissementPlan({
    valeurAcquisition: Number(immo.valeurAcquisition),
    dureeAmortissement: immo.dureeAmortissement,
    dateDebut: dateDebutAmort(immo),
  });

  res.json({ id: immo.id, code: immo.code, designation: immo.designation, plan });
});

const immobilisationUpdateSchema = immobilisationInputSchema.partial().extend({
  statut: STATUT_ENUM.optional(),
  dateCession: z.string().optional(),
  valeurCession: z.number().nonnegative().max(999999999.99).optional(),
  active: z.boolean().optional(),
});

// Pas de DELETE : archivage (erreur de saisie) via PATCH { active: false } —
// distinct de statut CEDE/REBUT qui modelise un evenement metier legitime
// (l'immobilisation reste visible dans l'historique).
immobilisationsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = immobilisationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { valeurAcquisition, valeurCession, dureeAmortissement, ...rest } = parsed.data;
  const [updated] = await db
    .update(immobilisationsTable)
    .set({
      ...rest,
      ...(valeurAcquisition !== undefined ? { valeurAcquisition: valeurAcquisition.toString() } : {}),
      ...(valeurCession !== undefined ? { valeurCession: valeurCession.toString() } : {}),
      ...(dureeAmortissement !== undefined ? { dureeAmortissement } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(immobilisationsTable.id, req.params.id), eq(immobilisationsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Immobilisation introuvable" });
    return;
  }
  res.json(withSnapshot(updated));
});
