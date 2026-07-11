import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, devisTable, licencesTable, relancesTable } from "@magestion/db";
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
    relanceCountByDevis.set(r.devisId, (relanceCountByDevis.get(r.devisId) ?? 0) + 1);
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
