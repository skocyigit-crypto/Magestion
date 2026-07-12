import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, facturesTable, factureLignesTable, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { recordFactureEmission } from "../lib/journalEntry.js";
import { licenceToPdfInfo, renderDocumentPdfBuffer, streamDocumentPdf, type DocumentPdfLigne } from "../lib/pdf.js";
import { EmailNotConfiguredError, escapeHtml, sendMail } from "../lib/mail.js";
import { generateFacturxXml, validateFacturxInvoice, type FacturxInvoiceInput, type FacturxLigne } from "../lib/facturx-xml.js";
import { getPdpConnector } from "../lib/pdp.js";
import { getLicencePdpLegalEntityId } from "../lib/pdp-legal-entity.js";
import { ligneInputSchema, ligneMontantHt, totalLignesHt, type LigneInput } from "../lib/lignes.js";

export const facturesRouter = Router();
facturesRouter.use(requireModuleAccess("factures"));

const factureUpdateSchema = z.object({
  objet: z.string().min(1).max(500).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientAdresse: z.string().max(500).optional(),
  clientCodePostal: z.string().max(10).optional(),
  clientVille: z.string().max(200).optional(),
  clientSiret: z.string().max(20).optional(),
  clientPays: z.string().max(100).optional(),
  montantHt: z.number().nonnegative().max(9999999999.99).optional(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  dateEcheance: z.string().optional(),
  active: z.boolean().optional(),
});

// Construit l'entree Factur-X a partir d'une facture + de la licence
// (vendeur). Partage entre /facturx-xml et /transmettre-pdp pour ne pas
// dupliquer le mapping.
function toFacturxInput(
  facture: typeof facturesTable.$inferSelect,
  licence: typeof licencesTable.$inferSelect | undefined,
): FacturxInvoiceInput {
  return {
    numero: facture.numero,
    dateEmission: facture.createdAt,
    dateEcheance: facture.dateEcheance,
    objet: facture.objet,
    montantHt: Number(facture.montantHt),
    tauxTva: Number(facture.tauxTva),
    vendeur: {
      nom: licence?.nom ?? "",
      siret: licence?.siret ?? null,
      tvaIntra: licence?.tvaIntracommunautaire ?? null,
      adresse: licence?.adresse ?? "",
      codePostal: licence?.codePostal ?? "",
      ville: licence?.ville ?? "",
    },
    acheteur: {
      nom: facture.client,
      siret: facture.clientSiret,
      adresse: facture.clientAdresse ?? "",
      codePostal: facture.clientCodePostal ?? "",
      ville: facture.clientVille ?? "",
      pays: facture.clientPays,
    },
  };
}

async function toPdfLignes(factureId: string): Promise<DocumentPdfLigne[] | undefined> {
  const rows = await db.select().from(factureLignesTable).where(eq(factureLignesTable.factureId, factureId));
  if (rows.length === 0) return undefined;
  return rows
    .sort((a, b) => a.ordre - b.ordre)
    .map((r) => {
      const l: LigneInput = { designation: r.designation, quantite: Number(r.quantite), unite: r.unite, prixUnitaireHt: Number(r.prixUnitaireHt), remisePercent: Number(r.remisePercent) };
      return { designation: l.designation, quantite: l.quantite, unite: r.unite, prixUnitaireHt: l.prixUnitaireHt, remisePercent: Number(r.remisePercent), montantHt: ligneMontantHt(l) };
    });
}

async function toFacturxLignes(factureId: string): Promise<FacturxLigne[] | undefined> {
  const rows = await db.select().from(factureLignesTable).where(eq(factureLignesTable.factureId, factureId));
  if (rows.length === 0) return undefined;
  return rows
    .sort((a, b) => a.ordre - b.ordre)
    .map((r) => {
      const l: LigneInput = { designation: r.designation, quantite: Number(r.quantite), unite: r.unite, prixUnitaireHt: Number(r.prixUnitaireHt), remisePercent: Number(r.remisePercent) };
      return { designation: r.designation, quantite: l.quantite, unite: r.unite, prixUnitaireHt: l.prixUnitaireHt, montantHt: ligneMontantHt(l) };
    });
}

facturesRouter.get("/:id/lignes", async (req, res) => {
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

  const lignes = await db.select().from(factureLignesTable).where(eq(factureLignesTable.factureId, facture.id));
  res.json(lignes.sort((a, b) => a.ordre - b.ordre));
});

// Meme logique que PUT /devis/:id/lignes : remplacement complet, reserve aux
// factures BROUILLON (le contenu est verrouille des l'emission). Le DELETE
// porte sur des sous-lignes d'un brouillon encore editable, pas sur la
// facture elle-meme (jamais supprimee).
facturesRouter.put("/:id/lignes", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ lignes: z.array(ligneInputSchema).min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
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
  if (facture.statut !== "BROUILLON") {
    res.status(423).json({ error: "Facture verrouillee (deja emise) — les lignes ne sont plus modifiables" });
    return;
  }

  await db.delete(factureLignesTable).where(eq(factureLignesTable.factureId, facture.id));
  const inserted = await db
    .insert(factureLignesTable)
    .values(parsed.data.lignes.map((l, i) => ({
      factureId: facture.id,
      ordre: i,
      designation: l.designation,
      quantite: l.quantite.toString(),
      unite: l.unite ?? "u",
      prixUnitaireHt: l.prixUnitaireHt.toString(),
      remisePercent: (l.remisePercent ?? 0).toString(),
    })))
    .returning();

  const montantHt = totalLignesHt(parsed.data.lignes);
  const [updatedFacture] = await db
    .update(facturesTable)
    .set({ montantHt: montantHt.toString(), updatedAt: new Date() })
    .where(eq(facturesTable.id, facture.id))
    .returning();

  res.json({ facture: updatedFacture, lignes: inserted.sort((a, b) => a.ordre - b.ordre) });
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
    licence: licenceToPdfInfo(licence),
    lignes: await toPdfLignes(facture.id),
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

  const { objet, clientEmail, clientAdresse, clientCodePostal, clientVille, clientSiret, clientPays, montantHt, tauxTva, dateEcheance, active } = parsed.data;
  // Les champs d'adresse acheteur restent modifiables meme apres emission :
  // ils ne changent aucun fait comptable (montant/objet/echeance) et sont
  // precisement ceux qu'on renseigne le plus souvent APRES coup, en
  // preparation d'une transmission PDP (voir /transmettre-pdp).
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
      ...(clientAdresse !== undefined ? { clientAdresse } : {}),
      ...(clientCodePostal !== undefined ? { clientCodePostal } : {}),
      ...(clientVille !== undefined ? { clientVille } : {}),
      ...(clientSiret !== undefined ? { clientSiret } : {}),
      ...(clientPays !== undefined ? { clientPays } : {}),
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
          licence: licenceToPdfInfo(licence),
          lignes: await toPdfLignes(updated.id),
        });
        await sendMail({
          to: updated.clientEmail,
          subject: `Facture ${updated.numero} — ${licence?.nom ?? ""}`,
          html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint notre facture <strong>${updated.numero}</strong> pour "${escapeHtml(updated.objet)}".</p><p>Cordialement,<br/>${escapeHtml(licence?.nom ?? "")}</p>`,
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

// Genere le XML Factur-X (CII EN16931) de la facture — utilisable en
// previsualisation des BROUILLON, meme si la transmission PDP (ci-dessous)
// n'est autorisee qu'une fois la facture EMISE (immuable).
facturesRouter.get("/:id/facturx-xml", async (req, res) => {
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
  const xml = generateFacturxXml({ ...toFacturxInput(facture, licence), lignes: await toFacturxLignes(facture.id) });

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="facturx-${facture.numero}.xml"`);
  res.send(xml);
});

// Transmission a la PDP (reelle si PDP_API_URL configuree, simulee sinon —
// voir lib/pdp.ts). Reservee aux factures EMISES (immuables) : transmettre
// un brouillon modifiable produirait un document legal qui pourrait ensuite
// changer sous les pieds du destinataire.
facturesRouter.post("/:id/transmettre-pdp", async (req, res) => {
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
  if (facture.statut === "BROUILLON") {
    res.status(409).json({ error: "La facture doit d'abord etre emise (statut Envoyee) avant transmission PDP" });
    return;
  }

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  const input = { ...toFacturxInput(facture, licence), lignes: await toFacturxLignes(facture.id) };
  const errors = validateFacturxInvoice(input);
  if (errors.length > 0) {
    res.status(400).json({ error: "Donnees insuffisantes pour la facturation electronique", details: errors });
    return;
  }

  const xml = generateFacturxXml(input);
  const connector = getPdpConnector();

  try {
    const legalEntityId = await getLicencePdpLegalEntityId(licenceId);
    const result = await connector.transmit({
      numero: facture.numero,
      xml,
      clientNom: facture.client,
      clientSiret: facture.clientSiret,
      montantTtc: Number(facture.montantHt) * (1 + Number(facture.tauxTva) / 100),
    }, legalEntityId);
    const [updated] = await db
      .update(facturesTable)
      .set({
        eStatut: result.status,
        ePlatformRef: result.platformRef,
        eSimulation: result.simulation,
        eTransmisAt: new Date(),
        eErreur: null,
        updatedAt: new Date(),
      })
      .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
      .returning();
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Echec de la transmission PDP";
    await db
      .update(facturesTable)
      .set({ eErreur: message, updatedAt: new Date() })
      .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)));
    res.status(502).json({ error: message });
  }
});

// Rafraichit le statut aupres de la PDP (deposee -> recue -> acceptee/refusee...).
facturesRouter.get("/:id/statut-pdp", async (req, res) => {
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
  if (!facture.ePlatformRef) {
    res.status(409).json({ error: "Facture jamais transmise a une PDP" });
    return;
  }

  const connector = getPdpConnector();
  try {
    const result = await connector.getStatus(facture.ePlatformRef);
    const [updated] = await db
      .update(facturesTable)
      .set({ eStatut: result.status, updatedAt: new Date() })
      .where(and(eq(facturesTable.id, req.params.id), eq(facturesTable.licenceId, licenceId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Echec de la recuperation du statut PDP" });
  }
});
