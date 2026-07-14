import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  ordresServiceTable,
  pvReceptionTable,
  dgdMarcheTable,
  garantiesMarcheTable,
  marcheSousTraitantsTable,
} from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const executionMarcheRouter = Router();
executionMarcheRouter.use(requireModuleAccess("executionMarche"));

function requireMarcheId(req: { query: Record<string, unknown> }, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const marcheId = req.query.marcheId;
  if (typeof marcheId !== "string") {
    res.status(400).json({ error: "marcheId requis en query" });
    return null;
  }
  return marcheId;
}

// --- Ordres de service ---
// numero unique par marche (contrainte DB) : instruction officielle CCAG-T,
// jamais deux OS avec le meme numero sur un meme marche — retry sur 23505
// comme lib/numbering.ts pour rester invisible en cas de course concurrente.
const osInputSchema = z.object({
  marcheId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  dateOs: z.string(),
  objet: z.string().min(1).max(500),
  prescription: z.string().min(1),
  delaiExecution: z.string().optional(),
  incidenceFinanciereHt: z.number().optional(),
  notes: z.string().optional(),
});

executionMarcheRouter.get("/ordres-service", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;
  const marcheId = requireMarcheId(req, res);
  if (!marcheId) return;

  const rows = await db
    .select()
    .from(ordresServiceTable)
    .where(and(eq(ordresServiceTable.licenceId, licenceId), eq(ordresServiceTable.marcheId, marcheId)));
  res.json(rows.sort((a, b) => a.numero - b.numero));
});

executionMarcheRouter.post("/ordres-service", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = osInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { incidenceFinanciereHt, dateOs, ...rest } = parsed.data;
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const existing = await db.select().from(ordresServiceTable).where(eq(ordresServiceTable.marcheId, parsed.data.marcheId));
    const numero = existing.reduce((max, o) => Math.max(max, o.numero), 0) + 1;
    try {
      const [created] = await db
        .insert(ordresServiceTable)
        .values({
          licenceId,
          ...rest,
          dateOs: new Date(dateOs),
          numero,
          incidenceFinanciereHt: incidenceFinanciereHt?.toString(),
        })
        .returning();
      res.status(201).json(created);
      return;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "23505" || attempt === MAX_ATTEMPTS) throw err;
    }
  }
});

executionMarcheRouter.patch("/ordres-service/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z
    .object({ statut: z.enum(["EXECUTE", "REFUSE", "RESERVES"]).optional(), reserves: z.string().optional(), notes: z.string().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(ordresServiceTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(ordresServiceTable.id, req.params.id), eq(ordresServiceTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Ordre de service introuvable" });
    return;
  }
  res.json(updated);
});

// --- Proces-verbaux de reception ---
const pvInputSchema = z.object({
  marcheId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  typePv: z.enum(["OPR", "RECEPTION", "RECEPTION_AVEC_RESERVES", "LEVEE_RESERVES", "REFUS_RECEPTION"]),
  datePv: z.string(),
  dateEffetReception: z.string().optional(),
  reserves: z.string().optional(),
  observations: z.string().optional(),
  declencheGaranties: z.boolean().optional(),
  notes: z.string().optional(),
});

executionMarcheRouter.get("/pv-reception", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;
  const marcheId = requireMarcheId(req, res);
  if (!marcheId) return;

  const rows = await db
    .select()
    .from(pvReceptionTable)
    .where(and(eq(pvReceptionTable.licenceId, licenceId), eq(pvReceptionTable.marcheId, marcheId)));
  res.json(rows);
});

executionMarcheRouter.post("/pv-reception", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = pvInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existing = await db.select().from(pvReceptionTable).where(eq(pvReceptionTable.marcheId, parsed.data.marcheId));
  const numero = existing.reduce((max, p) => Math.max(max, p.numero), 0) + 1;

  const { datePv, dateEffetReception, ...rest } = parsed.data;
  const [created] = await db
    .insert(pvReceptionTable)
    .values({
      licenceId,
      ...rest,
      numero,
      datePv: new Date(datePv),
      dateEffetReception: dateEffetReception ? new Date(dateEffetReception) : undefined,
    })
    .returning();
  res.status(201).json(created);
});

// --- Decompte General Definitif ---

const dgdInputSchema = z.object({
  marcheId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  dateEtablissement: z.string(),
  montantInitialHt: z.number().nonnegative(),
  montantAvenantsHt: z.number().default(0),
  montantRevisionHt: z.number().default(0),
  penalitesHt: z.number().default(0),
  primesHt: z.number().default(0),
  retenueGarantieHt: z.number().default(0),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  acomptesPercus: z.number().default(0),
  notes: z.string().optional(),
});

executionMarcheRouter.get("/dgd", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;
  const marcheId = requireMarcheId(req, res);
  if (!marcheId) return;

  const rows = await db.select().from(dgdMarcheTable).where(and(eq(dgdMarcheTable.licenceId, licenceId), eq(dgdMarcheTable.marcheId, marcheId)));
  res.json(rows);
});

executionMarcheRouter.post("/dgd", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = dgdInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existing = await db.select().from(dgdMarcheTable).where(eq(dgdMarcheTable.marcheId, parsed.data.marcheId));
  const numero = existing.reduce((max, d) => Math.max(max, d.numero), 0) + 1;

  const totalDgdHt =
    parsed.data.montantInitialHt +
    parsed.data.montantAvenantsHt +
    parsed.data.montantRevisionHt +
    parsed.data.primesHt -
    parsed.data.penalitesHt -
    parsed.data.retenueGarantieHt;
  const totalDgdTtc = totalDgdHt * (1 + parsed.data.tauxTva / 100);
  const soldeARegler = totalDgdTtc - parsed.data.acomptesPercus;

  const { dateEtablissement, tauxTva, montantInitialHt, montantAvenantsHt, montantRevisionHt, penalitesHt, primesHt, retenueGarantieHt, acomptesPercus, ...rest } = parsed.data;
  const [created] = await db
    .insert(dgdMarcheTable)
    .values({
      licenceId,
      ...rest,
      numero,
      dateEtablissement: new Date(dateEtablissement),
      tauxTva: tauxTva.toString(),
      montantInitialHt: montantInitialHt.toString(),
      montantAvenantsHt: montantAvenantsHt.toString(),
      montantRevisionHt: montantRevisionHt.toString(),
      penalitesHt: penalitesHt.toString(),
      primesHt: primesHt.toString(),
      retenueGarantieHt: retenueGarantieHt.toString(),
      acomptesPercus: acomptesPercus.toString(),
      totalDgdHt: totalDgdHt.toString(),
      totalDgdTtc: totalDgdTtc.toString(),
      soldeARegler: soldeARegler.toString(),
    })
    .returning();
  res.status(201).json(created);
});

const DGD_STATUT_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["ETABLI"],
  ETABLI: ["NOTIFIE"],
  NOTIFIE: ["ACCEPTE", "CONTESTE"],
  ACCEPTE: ["DEFINITIF"],
  CONTESTE: ["ETABLI"],
  DEFINITIF: [],
};

executionMarcheRouter.post("/dgd/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ETABLI", "NOTIFIE", "ACCEPTE", "CONTESTE", "DEFINITIF"]), reservesAcceptation: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [dgd] = await db.select().from(dgdMarcheTable).where(and(eq(dgdMarcheTable.id, req.params.id), eq(dgdMarcheTable.licenceId, licenceId))).limit(1);
  if (!dgd) {
    res.status(404).json({ error: "DGD introuvable" });
    return;
  }
  if (!DGD_STATUT_TRANSITIONS[dgd.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${dgd.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(dgdMarcheTable)
    .set({
      statut: parsed.data.statut,
      reservesAcceptation: parsed.data.reservesAcceptation,
      ...(parsed.data.statut === "NOTIFIE" ? { dateNotification: now } : {}),
      ...(parsed.data.statut === "ACCEPTE" ? { dateAcceptation: now } : {}),
      updatedAt: now,
    })
    .where(eq(dgdMarcheTable.id, dgd.id))
    .returning();
  res.json(updated);
});

// --- Garanties ---
const garantieInputSchema = z.object({
  marcheId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  typeGarantie: z.enum(["GPA", "BIENNALE", "DECENNALE", "CAUTION_DEFINITIVE", "RETENUE_GARANTIE", "CAUTION_AVANCE"]),
  emetteur: z.string().max(300).optional(),
  numeroActe: z.string().max(200).optional(),
  montantHt: z.number().nonnegative().optional(),
  pourcentage: z.number().nonnegative().max(100).optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  notes: z.string().optional(),
});

executionMarcheRouter.get("/garanties", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;
  const marcheId = requireMarcheId(req, res);
  if (!marcheId) return;

  const rows = await db
    .select()
    .from(garantiesMarcheTable)
    .where(and(eq(garantiesMarcheTable.licenceId, licenceId), eq(garantiesMarcheTable.marcheId, marcheId)));
  res.json(rows);
});

executionMarcheRouter.post("/garanties", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = garantieInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantHt, pourcentage, dateDebut, dateFin, ...rest } = parsed.data;
  const [created] = await db
    .insert(garantiesMarcheTable)
    .values({
      licenceId,
      ...rest,
      montantHt: montantHt?.toString(),
      pourcentage: pourcentage?.toString(),
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
    })
    .returning();
  res.status(201).json(created);
});

executionMarcheRouter.post("/garanties/:id/lever", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [garantie] = await db
    .select()
    .from(garantiesMarcheTable)
    .where(and(eq(garantiesMarcheTable.id, req.params.id), eq(garantiesMarcheTable.licenceId, licenceId)))
    .limit(1);
  if (!garantie) {
    res.status(404).json({ error: "Garantie introuvable" });
    return;
  }
  if (garantie.statut !== "ACTIVE") {
    res.status(409).json({ error: "Seule une garantie ACTIVE peut etre levee" });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(garantiesMarcheTable)
    .set({ statut: "LEVEE", dateLevee: now, updatedAt: now })
    .where(eq(garantiesMarcheTable.id, garantie.id))
    .returning();
  res.json(updated);
});

// --- Sous-traitance sur marche (DC4) ---
const sousTraitantMarcheInputSchema = z.object({
  marcheId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  sousTraitantId: z.string().uuid(),
  natureTravaux: z.string().min(1).max(500),
  montantSousTraiteHt: z.number().nonnegative(),
  paiementDirect: z.boolean().optional(),
  notes: z.string().optional(),
});

executionMarcheRouter.get("/sous-traitants", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;
  const marcheId = requireMarcheId(req, res);
  if (!marcheId) return;

  const rows = await db
    .select()
    .from(marcheSousTraitantsTable)
    .where(and(eq(marcheSousTraitantsTable.licenceId, licenceId), eq(marcheSousTraitantsTable.marcheId, marcheId)));
  res.json(rows);
});

executionMarcheRouter.post("/sous-traitants", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = sousTraitantMarcheInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantSousTraiteHt, ...rest } = parsed.data;
  const [created] = await db
    .insert(marcheSousTraitantsTable)
    .values({ licenceId, ...rest, montantSousTraiteHt: montantSousTraiteHt.toString() })
    .returning();
  res.status(201).json(created);
});

const ST_STATUT_TRANSITIONS: Record<string, string[]> = {
  PROPOSE: ["ACCEPTE_MOA", "REFUSE"],
  ACCEPTE_MOA: ["ACTIF"],
  ACTIF: ["TERMINE"],
  REFUSE: [],
  TERMINE: [],
};

executionMarcheRouter.post("/sous-traitants/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ACCEPTE_MOA", "REFUSE", "ACTIF", "TERMINE"]), motifRefus: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [row] = await db
    .select()
    .from(marcheSousTraitantsTable)
    .where(and(eq(marcheSousTraitantsTable.id, req.params.id), eq(marcheSousTraitantsTable.licenceId, licenceId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Sous-traitant marche introuvable" });
    return;
  }
  if (!ST_STATUT_TRANSITIONS[row.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${row.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const [updated] = await db
    .update(marcheSousTraitantsTable)
    .set({
      statut: parsed.data.statut,
      motifRefus: parsed.data.statut === "REFUSE" ? parsed.data.motifRefus : undefined,
      ...(parsed.data.statut === "ACCEPTE_MOA" ? { dateAgrement: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(marcheSousTraitantsTable.id, row.id))
    .returning();
  res.json(updated);
});
