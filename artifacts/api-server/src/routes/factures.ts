import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, facturesTable, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { recordFactureEmission } from "../lib/journalEntry.js";
import { renderDocumentPdfBuffer, streamDocumentPdf } from "../lib/pdf.js";
import { EmailNotConfiguredError, sendMail } from "../lib/mail.js";

export const facturesRouter = Router();
facturesRouter.use(requireModuleAccess("factures"));

const factureUpdateSchema = z.object({
  objet: z.string().min(1).max(500).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  montantHt: z.number().nonnegative().optional(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  dateEcheance: z.string().optional(),
  active: z.boolean().optional(),
});

facturesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.licenceId, licenceId), eq(facturesTable.active, !onlyInactive)));

  res.json(rows);
});

facturesRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [facture] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .limit(1);

  if (!facture) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  res.json(facture);
});

facturesRouter.get("/:id/pdf", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [facture] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .limit(1);
  if (!facture) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);

  streamDocumentPdf(res, {
    type: "FACTURE",
    numero: facture.numero,
    dateEmission: facture.createdAt,
    dateEcheance: facture.dateEcheance,
    client: facture.client,
    objet: facture.objet,
    montantHt: Number(facture.montantHt),
    tauxTva: Number(facture.tauxTva),
    licence: {
      nom: licence?.nom ?? "",
      siret: licence?.siret ?? null,
      adresse: licence?.adresse ?? null,
      codePostal: licence?.codePostal ?? null,
      ville: licence?.ville ?? null,
      email: licence?.email ?? null,
      telephone: licence?.telephone ?? null,
      tvaIntracommunautaire: licence?.tvaIntracommunautaire ?? null,
    },
  });
});

// Regle produit : une facture client n'est JAMAIS supprimee (403 pour tous
// les roles, meme SUPER_ADMIN — pas de route DELETE ici). Immutabilite :
// une fois EMISE (ENVOYEE/PAYEE/EN_RETARD), montant/objet/echeance sont
// verrouilles — seule la transition de statut (ex: marquer payee) reste possible.
facturesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = factureUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }

  const { objet, clientEmail, montantHt, tauxTva, dateEcheance, active } = parsed.data;
  const touchesLockedFields =
    objet !== undefined || clientEmail !== undefined || montantHt !== undefined || tauxTva !== undefined || dateEcheance !== undefined;
  if (touchesLockedFields && existing.statut !== "BROUILLON") {
    res.status(423).json({ error: "Facture verrouillee (deja emise) — seul le statut peut encore changer" });
    return;
  }

  const [updated] = await db
    .update(facturesTable)
    .set({
      ...(objet !== undefined ? { objet } : {}),
      ...(clientEmail !== undefined ? { clientEmail: clientEmail || null } : {}),
      ...(montantHt !== undefined ? { montantHt: montantHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      ...(dateEcheance !== undefined ? { dateEcheance } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

// L'ecriture VE est generee ICI (transition -> ENVOYEE), pas a la creation :
// une facture BROUILLON n'est pas encore un fait comptable/legal.
const TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["ENVOYEE"],
  ENVOYEE: ["PAYEE", "EN_RETARD"],
  EN_RETARD: ["PAYEE"],
  PAYEE: [],
};

facturesRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ENVOYEE", "PAYEE", "EN_RETARD"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [facture] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .limit(1);
  if (!facture) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }

  if (!TRANSITIONS[facture.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${facture.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(facturesTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "PAYEE" ? { datePaiement: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
    .returning();

  if (parsed.data.statut === "ENVOYEE") {
    await recordFactureEmission({
      licenceId,
      factureId: updated.id,
      numero: updated.numero,
      client: updated.client,
      montantHt: Number(updated.montantHt),
      tauxTva: Number(updated.tauxTva),
    });

    // Envoi d'email non bloquant : l'ecriture comptable ci-dessus reste le
    // fait generateur, l'echec/absence de config email ne doit pas l'annuler.
    if (updated.clientEmail) {
      try {
        const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
        const pdfBuffer = await renderDocumentPdfBuffer({
          type: "FACTURE",
          numero: updated.numero,
          dateEmission: updated.createdAt,
          dateEcheance: updated.dateEcheance,
          client: updated.client,
          objet: updated.objet,
          montantHt: Number(updated.montantHt),
          tauxTva: Number(updated.tauxTva),
          licence: {
            nom: licence?.nom ?? "",
            siret: licence?.siret ?? null,
            adresse: licence?.adresse ?? null,
            codePostal: licence?.codePostal ?? null,
            ville: licence?.ville ?? null,
            email: licence?.email ?? null,
            telephone: licence?.telephone ?? null,
            tvaIntracommunautaire: licence?.tvaIntracommunautaire ?? null,
          },
        });
        await sendMail({
          to: updated.clientEmail,
          subject: `Facture ${updated.numero} — ${licence?.nom ?? ""}`,
          html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint notre facture <strong>${updated.numero}</strong> pour "${updated.objet}".</p><p>Cordialement.</p>`,
          attachments: [{ filename: `facture-${updated.numero}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
        });
        res.json({ ...updated, emailSent: true });
        return;
      } catch (err) {
        const emailError = err instanceof EmailNotConfiguredError ? err.message : "Echec de l'envoi de l'email";
        res.json({ ...updated, emailSent: false, emailError });
        return;
      }
    }
  }

  res.json(updated);
});
