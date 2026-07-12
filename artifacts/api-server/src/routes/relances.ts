import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, devisTable, facturesTable, licencesTable, relancesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { EmailNotConfiguredError, escapeHtml, sendMail } from "../lib/mail.js";

export const relancesRouter = Router();
relancesRouter.use(requireModuleAccess("relances"));

// Sectoriel : ~30% des devis ne sont jamais relances. Paliers J+7/J+14/J+30
// calcules a la volee depuis devis.dateEnvoi — pas de champ stocke, pas de
// job planifie necessaire (voir aussi PROJECT_NOTES du projet de reference).
function palier(joursDepuisEnvoi: number): "J7" | "J14" | "J30" | null {
  if (joursDepuisEnvoi >= 30) return "J30";
  if (joursDepuisEnvoi >= 14) return "J14";
  if (joursDepuisEnvoi >= 7) return "J7";
  return null;
}

relancesRouter.get("/a-faire", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const devisEnvoyes = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.licenceId, licenceId), eq(devisTable.statut, "ENVOYE"), eq(devisTable.active, true)));

  const relancesRows = await db.select().from(relancesTable).where(eq(relancesTable.licenceId, licenceId));
  const relanceCountByDevis = new Map<string, number>();
  for (const r of relancesRows) {
    if (r.devisId) relanceCountByDevis.set(r.devisId, (relanceCountByDevis.get(r.devisId) ?? 0) + 1);
  }

  const aFaire = devisEnvoyes
    .map((d) => {
      const joursDepuisEnvoi = d.dateEnvoi
        ? Math.floor((Date.now() - new Date(d.dateEnvoi).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        devisId: d.id,
        numero: d.numero,
        client: d.client,
        objet: d.objet,
        montantHt: d.montantHt,
        dateEnvoi: d.dateEnvoi,
        joursDepuisEnvoi,
        palier: palier(joursDepuisEnvoi),
        nbRelancesEffectuees: relanceCountByDevis.get(d.id) ?? 0,
      };
    })
    .filter((d) => d.palier !== null)
    .sort((a, b) => b.joursDepuisEnvoi - a.joursDepuisEnvoi);

  res.json(aFaire);
});

// Escalade impayes (obligation de recouvrement) : RAPPEL (J+7 apres
// echeance) -> RELANCE_FERME (J+15) -> MISE_EN_DEMEURE (J+30), calculee a la
// volee depuis factures.dateEcheance — meme principe que /a-faire pour les devis.
function palierFacture(joursDeRetard: number): "RAPPEL" | "RELANCE_FERME" | "MISE_EN_DEMEURE" | null {
  if (joursDeRetard >= 30) return "MISE_EN_DEMEURE";
  if (joursDeRetard >= 15) return "RELANCE_FERME";
  if (joursDeRetard >= 7) return "RAPPEL";
  return null;
}

relancesRouter.get("/factures-a-faire", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const facturesImpayees = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.licenceId, licenceId), eq(facturesTable.active, true)));

  const relancesRows = await db.select().from(relancesTable).where(eq(relancesTable.licenceId, licenceId));
  const relanceCountByFacture = new Map<string, number>();
  for (const r of relancesRows) {
    if (r.factureId) relanceCountByFacture.set(r.factureId, (relanceCountByFacture.get(r.factureId) ?? 0) + 1);
  }

  const aFaire = facturesImpayees
    .filter((f) => (f.statut === "ENVOYEE" || f.statut === "EN_RETARD") && f.dateEcheance)
    .map((f) => {
      const joursDeRetard = Math.floor((Date.now() - new Date(f.dateEcheance!).getTime()) / (1000 * 60 * 60 * 24));
      return {
        factureId: f.id,
        numero: f.numero,
        client: f.client,
        objet: f.objet,
        montantHt: f.montantHt,
        tauxTva: f.tauxTva,
        dateEcheance: f.dateEcheance,
        joursDeRetard,
        niveau: palierFacture(joursDeRetard),
        nbRelancesEffectuees: relanceCountByFacture.get(f.id) ?? 0,
      };
    })
    .filter((f) => f.niveau !== null)
    .sort((a, b) => b.joursDeRetard - a.joursDeRetard);

  res.json(aFaire);
});

relancesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(relancesTable).where(eq(relancesTable.licenceId, licenceId));
  res.json(rows);
});

const relanceInputSchema = z.object({
  devisId: z.string().uuid(),
  type: z.enum(["EMAIL", "APPEL", "SMS", "AUTRE"]).optional(),
  notes: z.string().max(2000).optional(),
});

relancesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = relanceInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, parsed.data.devisId), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  const [created] = await db
    .insert(relancesTable)
    .values({ licenceId, devisId: parsed.data.devisId, type: parsed.data.type, notes: parsed.data.notes })
    .returning();

  // Une relance APPEL/SMS/AUTRE reste un simple log (action faite hors app).
  // Seule une relance EMAIL declenche un envoi reel — non bloquant : la
  // relance est deja enregistree ci-dessus quoi qu'il arrive.
  if ((parsed.data.type ?? "EMAIL") === "EMAIL") {
    if (!devis.clientEmail) {
      res.status(201).json({ ...created, emailSent: false, emailError: "Aucun email client renseigne sur ce devis" });
      return;
    }
    try {
      const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
      await sendMail({
        to: devis.clientEmail,
        subject: `Relance — Devis ${devis.numero} en attente de reponse`,
        html: `<p>Bonjour,</p><p>Nous revenons vers vous concernant le devis <strong>${devis.numero}</strong> ("${escapeHtml(devis.objet)}") envoye le ${devis.dateEnvoi ? new Date(devis.dateEnvoi).toLocaleDateString("fr-FR") : ""}, reste sans reponse a ce jour.</p><p>N'hesitez pas a nous contacter pour toute question.</p><p>Cordialement,<br/>${escapeHtml(licence?.nom ?? "")}</p>`,
      });
      res.status(201).json({ ...created, emailSent: true });
    } catch (err) {
      const emailError = err instanceof EmailNotConfiguredError ? err.message : "Echec de l'envoi de l'email";
      res.status(201).json({ ...created, emailSent: false, emailError });
    }
    return;
  }

  res.status(201).json(created);
});

const RELANCE_FACTURE_TEMPLATES: Record<"RAPPEL" | "RELANCE_FERME" | "MISE_EN_DEMEURE", (numero: string, objet: string, montantTtc: string, joursDeRetard: number) => { subject: string; html: string }> = {
  RAPPEL: (numero, objet, montantTtc) => ({
    subject: `Rappel — Facture ${numero} en attente de paiement`,
    html: `<p>Bonjour,</p><p>Sauf erreur de notre part, la facture <strong>${numero}</strong> ("${escapeHtml(objet)}") d'un montant de ${montantTtc} € TTC n'a pas encore ete reglee. Nous vous remercions de bien vouloir regulariser cette situation dans les meilleurs delais.</p><p>Cordialement,</p>`,
  }),
  RELANCE_FERME: (numero, objet, montantTtc, joursDeRetard) => ({
    subject: `Relance — Facture ${numero} impayee depuis ${joursDeRetard} jours`,
    html: `<p>Bonjour,</p><p>Malgre notre precedent rappel, la facture <strong>${numero}</strong> ("${escapeHtml(objet)}") d'un montant de ${montantTtc} € TTC reste impayee, avec ${joursDeRetard} jours de retard. Merci de proceder au reglement sous 8 jours.</p><p>Cordialement,</p>`,
  }),
  MISE_EN_DEMEURE: (numero, objet, montantTtc, joursDeRetard) => ({
    subject: `Mise en demeure — Facture ${numero}`,
    html: `<p>Madame, Monsieur,</p><p>Par la presente, nous vous mettons en demeure de regler la facture <strong>${numero}</strong> ("${escapeHtml(objet)}") d'un montant de ${montantTtc} € TTC, impayee depuis ${joursDeRetard} jours, sous 8 jours a compter de la reception de ce courrier, faute de quoi nous nous reservons le droit d'engager toute action de recouvrement, y compris judiciaire, sans autre avis.</p><p>Conformement a l'article L441-10 du Code de commerce, une penalite de retard et une indemnite forfaitaire de recouvrement de 40 € sont applicables.</p><p>Cordialement,</p>`,
  }),
};

const relanceFactureInputSchema = z.object({
  factureId: z.string().uuid(),
  type: z.enum(["EMAIL", "APPEL", "SMS", "AUTRE"]).optional(),
  notes: z.string().max(2000).optional(),
});

relancesRouter.post("/facture", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = relanceFactureInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [facture] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, parsed.data.factureId), eq(facturesTable.licenceId, licenceId)))
    .limit(1);
  if (!facture) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  if (!facture.dateEcheance) {
    res.status(409).json({ error: "Facture sans date d'echeance — impossible de calculer un palier de relance" });
    return;
  }

  const joursDeRetard = Math.floor((Date.now() - new Date(facture.dateEcheance).getTime()) / (1000 * 60 * 60 * 24));
  const niveau = palierFacture(joursDeRetard);
  if (!niveau) {
    res.status(409).json({ error: "Cette facture n'est pas encore en retard suffisant pour une relance (J+7 minimum)" });
    return;
  }

  // Une relance en retard signale mecaniquement le passage EN_RETARD si ce
  // n'etait pas deja le cas — coherent avec le palier qu'on vient de calculer.
  if (facture.statut === "ENVOYEE") {
    await db.update(facturesTable).set({ statut: "EN_RETARD", updatedAt: new Date() }).where(eq(facturesTable.id, facture.id));
  }

  const [created] = await db
    .insert(relancesTable)
    .values({ licenceId, factureId: facture.id, niveau, type: parsed.data.type, notes: parsed.data.notes })
    .returning();

  if ((parsed.data.type ?? "EMAIL") === "EMAIL") {
    if (!facture.clientEmail) {
      res.status(201).json({ ...created, emailSent: false, emailError: "Aucun email client renseigne sur cette facture" });
      return;
    }
    try {
      const montantTtc = (Number(facture.montantHt) * (1 + Number(facture.tauxTva) / 100)).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
      const { subject, html } = RELANCE_FACTURE_TEMPLATES[niveau](facture.numero, facture.objet, montantTtc, joursDeRetard);
      await sendMail({ to: facture.clientEmail, subject, html });
      res.status(201).json({ ...created, emailSent: true });
    } catch (err) {
      const emailError = err instanceof EmailNotConfiguredError ? err.message : "Echec de l'envoi de l'email";
      res.status(201).json({ ...created, emailSent: false, emailError });
    }
    return;
  }

  res.status(201).json(created);
});
