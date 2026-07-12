import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, devisTable, facturesTable, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { withNumero } from "../lib/numbering.js";
import { licenceToPdfInfo, renderDocumentPdfBuffer, streamDocumentPdf } from "../lib/pdf.js";
import { EmailNotConfiguredError, escapeHtml, sendMail } from "../lib/mail.js";

export const devisRouter = Router();
devisRouter.use(requireModuleAccess("devis"));

const devisInputSchema = z.object({
  client: z.string().min(1).max(200),
  clientEmail: z.string().email().optional().or(z.literal("")),
  objet: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
  montantHt: z.number().nonnegative().max(9999999999.99),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const devisUpdateSchema = devisInputSchema.partial().extend({
  active: z.boolean().optional(),
});

devisRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.licenceId, licenceId), eq(devisTable.active, !onlyInactive)));

  res.json(rows);
});

devisRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = devisInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const created = await withNumero("devis", "DEV", licenceId, async (numero) => {
    const [row] = await db
      .insert(devisTable)
      .values({
        licenceId,
        numero,
        client: parsed.data.client,
        clientEmail: parsed.data.clientEmail || undefined,
        objet: parsed.data.objet,
        projectId: parsed.data.projectId,
        montantHt: parsed.data.montantHt.toString(),
        tauxTva: parsed.data.tauxTva.toString(),
      })
      .returning();
    return row;
  });

  res.status(201).json(created);
});

devisRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);

  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }
  res.json(devis);
});

devisRouter.get("/:id/pdf", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);

  streamDocumentPdf(res, {
    type: "DEVIS",
    numero: devis.numero,
    dateEmission: devis.createdAt,
    client: devis.client,
    objet: devis.objet,
    montantHt: Number(devis.montantHt),
    tauxTva: Number(devis.tauxTva),
    licence: licenceToPdfInfo(licence),
  });
});

// Regle produit : un devis n'est JAMAIS supprime (403 pour tous les roles).
// Pas de DELETE ici ; PATCH { active: false } = archivage reversible.
// Immutabilite (comme les factures) : une fois envoye au client, le contenu
// chiffre (client/objet/montant/tva/projectId) est verrouille — seule la
// transition de statut et l'archivage restent possibles, pour ne jamais
// modifier silencieusement un devis deja transmis.
devisRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = devisUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  const { montantHt, tauxTva, active, ...rest } = parsed.data;
  const touchesLockedFields = montantHt !== undefined || tauxTva !== undefined || Object.keys(rest).length > 0;
  if (touchesLockedFields && existing.statut !== "BROUILLON") {
    res.status(423).json({ error: "Devis verrouille (deja envoye) — seuls le statut et l'archivage restent possibles" });
    return;
  }

  const [updated] = await db
    .update(devisTable)
    .set({
      ...rest,
      ...(montantHt !== undefined ? { montantHt: montantHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

// Flux impose : Brouillon -> Envoye -> Accepte / Refuse.
const TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["ENVOYE"],
  ENVOYE: ["ACCEPTE", "REFUSE"],
  ACCEPTE: [],
  REFUSE: [],
};

devisRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ENVOYE", "ACCEPTE", "REFUSE"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  if (!TRANSITIONS[devis.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${devis.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(devisTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "ENVOYE" ? { dateEnvoi: now } : {}),
      ...(parsed.data.statut === "ACCEPTE" || parsed.data.statut === "REFUSE" ? { dateReponse: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .returning();

  // Envoi d'email non bloquant : la transition de statut reste la source de
  // verite, l'echec/absence de config email ne doit jamais la faire echouer.
  if (parsed.data.statut === "ENVOYE" && updated.clientEmail) {
    try {
      const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
      const pdfBuffer = await renderDocumentPdfBuffer({
        type: "DEVIS",
        numero: updated.numero,
        dateEmission: updated.createdAt,
        client: updated.client,
        objet: updated.objet,
        montantHt: Number(updated.montantHt),
        tauxTva: Number(updated.tauxTva),
        licence: licenceToPdfInfo(licence),
      });
      await sendMail({
        to: updated.clientEmail,
        subject: `Devis ${updated.numero} — ${licence?.nom ?? ""}`,
        html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint notre devis <strong>${updated.numero}</strong> pour "${escapeHtml(updated.objet)}".</p><p>Cordialement,<br/>${escapeHtml(licence?.nom ?? "")}</p>`,
        attachments: [{ filename: `devis-${updated.numero}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });
      res.json({ ...updated, emailSent: true });
      return;
    } catch (err) {
      const emailError = err instanceof EmailNotConfiguredError ? err.message : "Echec de l'envoi de l'email";
      res.json({ ...updated, emailSent: false, emailError });
      return;
    }
  }

  res.json(updated);
});

// Convertit un devis ACCEPTE en facture (Brouillon). Idempotent : si une
// facture existe deja pour ce devis, la retourne au lieu d'en recreer une.
devisRouter.post("/:id/convertir-facture", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }
  if (devis.statut !== "ACCEPTE") {
    res.status(409).json({ error: "Seul un devis ACCEPTE peut etre converti en facture" });
    return;
  }

  const [existing] = await db.select().from(facturesTable).where(eq(facturesTable.devisId, devis.id)).limit(1);
  if (existing) {
    res.json(existing);
    return;
  }

  const facture = await withNumero("factures", "FAC", licenceId, async (numero) => {
    const [row] = await db
      .insert(facturesTable)
      .values({
        licenceId,
        projectId: devis.projectId,
        devisId: devis.id,
        numero,
        client: devis.client,
        clientEmail: devis.clientEmail,
        objet: devis.objet,
        montantHt: devis.montantHt,
        tauxTva: devis.tauxTva,
      })
      .returning();
    return row;
  });

  res.status(201).json(facture);
});
