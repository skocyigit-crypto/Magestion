import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, prospectsTable, journalRgpdTable, devisTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { computeLeadScore } from "../lib/leadScoring.js";
import { withNumero } from "../lib/numbering.js";

export const prospectsRouter = Router();
prospectsRouter.use(requireModuleAccess("prospects"));

const urgenceEnum = z.enum(["BASSE", "NORMALE", "URGENTE", "TRES_URGENTE"]);
const statutEnum = z.enum(["NOUVEAU", "CONTACTE", "RDV_PLANIFIE", "DEVIS_ENVOYE", "NEGOCIATION", "GAGNE", "PERDU"]);
const raisonPerteEnum = z.enum(["PRIX", "DELAI", "CONCURRENT", "SANS_SUITE", "AUTRE"]);

const prospectInputSchema = z.object({
  nom: z.string().min(1).max(200),
  contact: z.string().max(200).optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  adresse: z.string().max(500).optional(),
  codePostal: z.string().max(10).optional(),
  budgetEstime: z.number().nonnegative().max(9999999999.99).optional(),
  distanceKm: z.number().nonnegative().optional(),
  urgence: urgenceEnum.optional(),
  notes: z.string().max(4000).optional(),
});

const prospectUpdateSchema = prospectInputSchema.partial().extend({
  statut: statutEnum.optional(),
  active: z.boolean().optional(),
  consentementRgpd: z.boolean().optional(),
  raisonPerte: raisonPerteEnum.optional(),
  raisonPerteDetail: z.string().max(2000).optional(),
});

// GET /prospects?onlyInactive=true -> corbeille (archives), sinon liste active par defaut
prospectsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.licenceId, licenceId), eq(prospectsTable.active, !onlyInactive)));

  res.json(rows);
});

prospectsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ force: z.boolean().optional() }).and(prospectInputSchema).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  // Detection de doublon (telephone/email deja utilise par un prospect actif)
  // — avertit plutot que de bloquer : le meme contact peut legitimement
  // revenir sur un nouveau projet. `force: true` cree quand meme.
  if (!parsed.data.force && (parsed.data.telephone || parsed.data.email)) {
    const actifs = await db.select().from(prospectsTable).where(and(eq(prospectsTable.licenceId, licenceId), eq(prospectsTable.active, true)));
    const telephoneNorm = parsed.data.telephone?.replace(/[\s.-]/g, "");
    const doublon = actifs.find(
      (p) =>
        (telephoneNorm && p.telephone?.replace(/[\s.-]/g, "") === telephoneNorm) ||
        (parsed.data.email && p.email?.toLowerCase() === parsed.data.email.toLowerCase()),
    );
    if (doublon) {
      res.status(409).json({ error: "Un prospect actif existe deja avec ce telephone/email", doublon: { id: doublon.id, nom: doublon.nom, statut: doublon.statut } });
      return;
    }
  }

  const budgetEstime = parsed.data.budgetEstime ?? 0;
  const urgence = parsed.data.urgence ?? "NORMALE";
  const score = computeLeadScore({ budgetEstime, urgence, distanceKm: parsed.data.distanceKm });

  const [created] = await db
    .insert(prospectsTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      contact: parsed.data.contact,
      telephone: parsed.data.telephone,
      email: parsed.data.email || undefined,
      adresse: parsed.data.adresse,
      codePostal: parsed.data.codePostal,
      budgetEstime: budgetEstime.toString(),
      distanceKm: parsed.data.distanceKm?.toString(),
      urgence,
      notes: parsed.data.notes,
      score,
    })
    .returning();

  res.status(201).json(created);
});

prospectsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [prospect] = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .limit(1);

  if (!prospect) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }
  res.json(prospect);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
prospectsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = prospectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }

  // Marquer PERDU sans motif prive l'analyse commerciale de tout signal
  // exploitable — exige raisonPerte dans cette requete ou deja enregistree.
  if (parsed.data.statut === "PERDU" && !parsed.data.raisonPerte && !existing.raisonPerte) {
    res.status(400).json({ error: "raisonPerte requise pour marquer un prospect PERDU" });
    return;
  }

  const { budgetEstime, distanceKm, urgence, consentementRgpd, ...rest } = parsed.data;
  // Recalcul du score si l'un des facteurs change (budget/urgence/distance).
  const nextBudget = budgetEstime ?? Number(existing.budgetEstime);
  const nextUrgence = urgence ?? existing.urgence;
  const nextDistance = distanceKm ?? (existing.distanceKm ? Number(existing.distanceKm) : undefined);
  const score = computeLeadScore({ budgetEstime: nextBudget, urgence: nextUrgence, distanceKm: nextDistance });

  const [updated] = await db
    .update(prospectsTable)
    .set({
      ...rest,
      ...(budgetEstime !== undefined ? { budgetEstime: budgetEstime.toString() } : {}),
      ...(distanceKm !== undefined ? { distanceKm: distanceKm.toString() } : {}),
      ...(urgence !== undefined ? { urgence } : {}),
      ...(consentementRgpd !== undefined ? { consentementRgpd, consentementDate: new Date() } : {}),
      score,
      updatedAt: new Date(),
    })
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .returning();

  // Le consentement (RGPD art. 7 : preuve du consentement) est journalise
  // separement du reste des modifications, meme regroupe dans un seul PATCH.
  if (consentementRgpd !== undefined) {
    await db.insert(journalRgpdTable).values({
      licenceId,
      action: "CONSENTEMENT",
      entityType: "PROSPECT",
      entityId: updated.id,
      effectuePar: req.user!.sub,
      detail: consentementRgpd ? "Consentement accorde" : "Consentement retire",
    });
  }

  res.json(updated);
});

// Cree un devis BROUILLON prefilled depuis un prospect (client/email repris,
// budget estime comme montant de depart — a affiner) et fait avancer le
// prospect a DEVIS_ENVOYE si son statut ne l'a pas deja depasse. N'importe
// combien de devis peuvent etre crees depuis le meme prospect (pas d'idempotence).
prospectsRouter.post("/:id/convertir-devis", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [prospect] = await db
    .select()
    .from(prospectsTable)
    .where(and(eq(prospectsTable.id, req.params.id), eq(prospectsTable.licenceId, licenceId)))
    .limit(1);
  if (!prospect) {
    res.status(404).json({ error: "Prospect introuvable" });
    return;
  }

  const devis = await withNumero("devis", "DEV", licenceId, async (numero) => {
    const [row] = await db
      .insert(devisTable)
      .values({
        licenceId,
        numero,
        client: prospect.nom,
        clientEmail: prospect.email || undefined,
        objet: prospect.notes ? prospect.notes.slice(0, 500) : `Devis suite a contact — ${prospect.nom}`,
        montantHt: prospect.budgetEstime,
        tauxTva: "20",
      })
      .returning();
    return row;
  });

  const PROGRESSION: Record<string, boolean> = { NOUVEAU: true, CONTACTE: true, RDV_PLANIFIE: true };
  if (PROGRESSION[prospect.statut]) {
    await db.update(prospectsTable).set({ statut: "DEVIS_ENVOYE", updatedAt: new Date() }).where(eq(prospectsTable.id, prospect.id));
  }

  res.status(201).json(devis);
});
