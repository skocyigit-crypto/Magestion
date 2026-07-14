import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, marchesPublicsTable, avenantsMarcheTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { withNumero } from "../lib/numbering.js";

export const marchesPublicsRouter = Router();
marchesPublicsRouter.use(requireModuleAccess("marchesPublics"));

const marcheInputSchema = z.object({
  intitule: z.string().min(1).max(500),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  devisId: z.string().uuid().optional(),
  typeMarche: z.enum(["TRAVAUX", "SERVICES", "FOURNITURES"]).optional(),
  procedureType: z.string().max(50).optional(),
  montantInitialHt: z.number().nonnegative(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  dateNotification: z.string().optional(),
  dateDebutTravaux: z.string().optional(),
  dateFinPrevue: z.string().optional(),
  delaiExecutionMois: z.number().int().nonnegative().optional(),
  clauseRevisionPrix: z.boolean().optional(),
  indiceReference: z.string().max(50).optional(),
  valeurIndiceMoisZero: z.number().nonnegative().optional(),
  cautionDefinitivePourcent: z.number().nonnegative().max(100).optional(),
  retenueGarantiePourcent: z.number().nonnegative().max(100).optional(),
  delaiGarantieMois: z.number().int().nonnegative().optional(),
  penalitesRetardJour: z.number().nonnegative().optional(),
  plafondPenalitesPourcent: z.number().nonnegative().max(100).optional(),
  notes: z.string().optional(),
});

const marcheUpdateSchema = marcheInputSchema.partial().extend({
  active: z.boolean().optional(),
  dateReception: z.string().optional(),
});

marchesPublicsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(marchesPublicsTable)
    .where(and(eq(marchesPublicsTable.licenceId, licenceId), eq(marchesPublicsTable.active, !onlyInactive)));
  res.json(rows);
});

marchesPublicsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = marcheInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const {
    montantInitialHt,
    tauxTva,
    valeurIndiceMoisZero,
    cautionDefinitivePourcent,
    retenueGarantiePourcent,
    penalitesRetardJour,
    plafondPenalitesPourcent,
    dateNotification,
    dateDebutTravaux,
    dateFinPrevue,
    ...rest
  } = parsed.data;
  const created = await withNumero("marches_publics", "MP", licenceId, async (numero) => {
    const [row] = await db
      .insert(marchesPublicsTable)
      .values({
        licenceId,
        numero,
        ...rest,
        montantInitialHt: montantInitialHt.toString(),
        montantActuelHt: montantInitialHt.toString(),
        tauxTva: tauxTva.toString(),
        valeurIndiceMoisZero: valeurIndiceMoisZero?.toString(),
        cautionDefinitivePourcent: cautionDefinitivePourcent?.toString(),
        retenueGarantiePourcent: retenueGarantiePourcent?.toString(),
        penalitesRetardJour: penalitesRetardJour?.toString(),
        plafondPenalitesPourcent: plafondPenalitesPourcent?.toString(),
        dateNotification: dateNotification ? new Date(dateNotification) : undefined,
        dateDebutTravaux: dateDebutTravaux ? new Date(dateDebutTravaux) : undefined,
        dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : undefined,
      })
      .returning();
    return row;
  });

  res.status(201).json(created);
});

marchesPublicsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [row] = await db
    .select()
    .from(marchesPublicsTable)
    .where(and(eq(marchesPublicsTable.id, req.params.id), eq(marchesPublicsTable.licenceId, licenceId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Marche introuvable" });
    return;
  }
  res.json(row);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
marchesPublicsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = marcheUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const {
    montantInitialHt,
    tauxTva,
    valeurIndiceMoisZero,
    cautionDefinitivePourcent,
    retenueGarantiePourcent,
    penalitesRetardJour,
    plafondPenalitesPourcent,
    dateNotification,
    dateDebutTravaux,
    dateFinPrevue,
    dateReception,
    ...rest
  } = parsed.data;
  const [updated] = await db
    .update(marchesPublicsTable)
    .set({
      ...rest,
      ...(montantInitialHt !== undefined ? { montantInitialHt: montantInitialHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      ...(valeurIndiceMoisZero !== undefined ? { valeurIndiceMoisZero: valeurIndiceMoisZero.toString() } : {}),
      ...(cautionDefinitivePourcent !== undefined ? { cautionDefinitivePourcent: cautionDefinitivePourcent.toString() } : {}),
      ...(retenueGarantiePourcent !== undefined ? { retenueGarantiePourcent: retenueGarantiePourcent.toString() } : {}),
      ...(penalitesRetardJour !== undefined ? { penalitesRetardJour: penalitesRetardJour.toString() } : {}),
      ...(plafondPenalitesPourcent !== undefined ? { plafondPenalitesPourcent: plafondPenalitesPourcent.toString() } : {}),
      ...(dateNotification !== undefined ? { dateNotification: new Date(dateNotification) } : {}),
      ...(dateDebutTravaux !== undefined ? { dateDebutTravaux: new Date(dateDebutTravaux) } : {}),
      ...(dateFinPrevue !== undefined ? { dateFinPrevue: new Date(dateFinPrevue) } : {}),
      ...(dateReception !== undefined ? { dateReception: new Date(dateReception) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(marchesPublicsTable.id, req.params.id), eq(marchesPublicsTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Marche introuvable" });
    return;
  }
  res.json(updated);
});

const STATUT_TRANSITIONS: Record<string, string[]> = {
  EN_COURS: ["TERMINE", "RESILIE", "SUSPENDU"],
  SUSPENDU: ["EN_COURS", "RESILIE"],
  TERMINE: [],
  RESILIE: [],
};

marchesPublicsRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["EN_COURS", "TERMINE", "RESILIE", "SUSPENDU"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [row] = await db
    .select()
    .from(marchesPublicsTable)
    .where(and(eq(marchesPublicsTable.id, req.params.id), eq(marchesPublicsTable.licenceId, licenceId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Marche introuvable" });
    return;
  }
  if (!STATUT_TRANSITIONS[row.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${row.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(marchesPublicsTable)
    .set({ statut: parsed.data.statut, ...(parsed.data.statut === "TERMINE" ? { dateReception: now } : {}), updatedAt: now })
    .where(eq(marchesPublicsTable.id, row.id))
    .returning();
  res.json(updated);
});

// --- Avenants ---

const avenantInputSchema = z.object({
  typeAvenant: z.enum(["REVISION_PRIX", "TRAVAUX_SUPPLEMENTAIRES", "PROLONGATION_DELAI", "AUTRE"]).optional(),
  objet: z.string().min(1).max(500),
  montantHt: z.number().default(0),
  indiceBase: z.number().nonnegative().optional(),
  indiceActuel: z.number().nonnegative().optional(),
  coefficientRevision: z.number().nonnegative().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
});

marchesPublicsRouter.get("/:id/avenants", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(avenantsMarcheTable)
    .where(and(eq(avenantsMarcheTable.marcheId, req.params.id), eq(avenantsMarcheTable.licenceId, licenceId)));
  res.json(rows.sort((a, b) => a.numero - b.numero));
});

marchesPublicsRouter.post("/:id/avenants", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = avenantInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [marche] = await db
    .select()
    .from(marchesPublicsTable)
    .where(and(eq(marchesPublicsTable.id, req.params.id), eq(marchesPublicsTable.licenceId, licenceId)))
    .limit(1);
  if (!marche) {
    res.status(404).json({ error: "Marche introuvable" });
    return;
  }

  const existing = await db.select().from(avenantsMarcheTable).where(eq(avenantsMarcheTable.marcheId, marche.id));
  const nextNumero = existing.reduce((max, a) => Math.max(max, a.numero), 0) + 1;

  const { montantHt, indiceBase, indiceActuel, coefficientRevision, ...rest } = parsed.data;
  const [created] = await db
    .insert(avenantsMarcheTable)
    .values({
      licenceId,
      marcheId: marche.id,
      numero: nextNumero,
      ...rest,
      montantHt: montantHt.toString(),
      indiceBase: indiceBase?.toString(),
      indiceActuel: indiceActuel?.toString(),
      coefficientRevision: coefficientRevision?.toString(),
    })
    .returning();
  res.status(201).json(created);
});

// Workflow sequentiel BROUILLON -> SIGNE -> TRANSMIS -> IMPUTE. L'imputation
// ajoute montantHt au montant_actuel_ht du marche (base du prochain DGD) —
// c'est la seule etape qui a un effet financier reel, les autres ne font
// qu'attester d'une etape administrative (cf. lib/db/src/schema/marchesPublics.ts).
const AVENANT_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["SIGNE"],
  SIGNE: ["TRANSMIS"],
  TRANSMIS: ["IMPUTE"],
  IMPUTE: [],
};

marchesPublicsRouter.post("/:id/avenants/:avenantId/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z
    .object({ statut: z.enum(["SIGNE", "TRANSMIS", "IMPUTE"]), modeTransmission: z.enum(["mail", "courrier_ar", "main_propre"]).optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [avenant] = await db
    .select()
    .from(avenantsMarcheTable)
    .where(
      and(
        eq(avenantsMarcheTable.id, req.params.avenantId),
        eq(avenantsMarcheTable.marcheId, req.params.id),
        eq(avenantsMarcheTable.licenceId, licenceId),
      ),
    )
    .limit(1);
  if (!avenant) {
    res.status(404).json({ error: "Avenant introuvable" });
    return;
  }
  if (!AVENANT_TRANSITIONS[avenant.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${avenant.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }
  if (parsed.data.statut === "TRANSMIS" && !parsed.data.modeTransmission) {
    res.status(400).json({ error: "modeTransmission requis pour la transmission" });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(avenantsMarcheTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "TRANSMIS" ? { modeTransmission: parsed.data.modeTransmission, dateTransmission: now } : {}),
      ...(parsed.data.statut === "IMPUTE" ? { dateImputation: now } : {}),
      updatedAt: now,
    })
    .where(eq(avenantsMarcheTable.id, avenant.id))
    .returning();

  if (parsed.data.statut === "IMPUTE") {
    const [marche] = await db.select().from(marchesPublicsTable).where(eq(marchesPublicsTable.id, avenant.marcheId)).limit(1);
    if (marche) {
      const nouveauMontant = Number(marche.montantActuelHt) + Number(avenant.montantHt);
      await db
        .update(marchesPublicsTable)
        .set({ montantActuelHt: nouveauMontant.toString(), updatedAt: now })
        .where(eq(marchesPublicsTable.id, marche.id));
    }
  }

  res.json(updated);
});
