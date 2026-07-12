import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { db, transactionsBancairesTable, facturesTable, depensesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { parseBankCsv } from "../lib/bank-csv.js";

export const transactionsBancairesRouter = Router();
transactionsBancairesRouter.use(requireModuleAccess("comptabilite"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function montantTtc(montantHt: string, tauxTva: string): number {
  return round2(Number(montantHt) * (1 + Number(tauxTva) / 100));
}

// Rapprochement automatique : ne s'engage QUE si le montant correspond a
// exactement un document en attente de paiement (aucune ambiguite). Sinon
// la ligne reste NON_RAPPROCHE pour une revue manuelle — mieux vaut ne rien
// faire qu'un rapprochement incorrect sur un montant qui apparait plusieurs fois.
async function tryAutoMatch(licenceId: string, transactionId: string, montant: number) {
  if (montant > 0) {
    const candidates = await db
      .select()
      .from(facturesTable)
      .where(and(eq(facturesTable.licenceId, licenceId), eq(facturesTable.active, true), or(eq(facturesTable.statut, "ENVOYEE"), eq(facturesTable.statut, "EN_RETARD"))));
    const matches = candidates.filter((f) => montantTtc(f.montantHt, f.tauxTva) === round2(montant));
    if (matches.length === 1) {
      const facture = matches[0];
      await db.update(facturesTable).set({ statut: "PAYEE", datePaiement: new Date(), updatedAt: new Date() }).where(eq(facturesTable.id, facture.id));
      await db.update(transactionsBancairesTable).set({ rapprochementStatut: "RAPPROCHE_AUTO", factureId: facture.id }).where(eq(transactionsBancairesTable.id, transactionId));
      return true;
    }
  } else if (montant < 0) {
    const candidates = await db
      .select()
      .from(depensesTable)
      .where(and(eq(depensesTable.licenceId, licenceId), eq(depensesTable.active, true), or(eq(depensesTable.statut, "A_VALIDER"), eq(depensesTable.statut, "BON_A_PAYER"))));
    const matches = candidates.filter((d) => montantTtc(d.montantHt, d.tauxTva) === round2(Math.abs(montant)));
    if (matches.length === 1) {
      const depense = matches[0];
      await db.update(depensesTable).set({ statut: "PAYEE", datePaiement: new Date(), updatedAt: new Date() }).where(eq(depensesTable.id, depense.id));
      await db.update(transactionsBancairesTable).set({ rapprochementStatut: "RAPPROCHE_AUTO", depenseId: depense.id }).where(eq(transactionsBancairesTable.id, transactionId));
      return true;
    }
  }
  return false;
}

transactionsBancairesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(transactionsBancairesTable).where(eq(transactionsBancairesTable.licenceId, licenceId));
  res.json(rows);
});

// Import CSV (multipart "file" ou texte brut dans le corps). Cree une ligne
// par operation puis tente un rapprochement automatique pour chacune.
transactionsBancairesRouter.post("/import", upload.single("file"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const content = req.file ? req.file.buffer.toString("utf8") : typeof req.body?.content === "string" ? req.body.content : null;
  if (!content) {
    res.status(400).json({ error: "Fichier CSV requis (champ 'file' ou 'content')" });
    return;
  }

  const parsed = parseBankCsv(content);
  if (parsed.length === 0) {
    res.status(400).json({ error: "Aucune operation exploitable dans ce fichier (format attendu : date;libelle;montant)" });
    return;
  }

  const importBatchId = randomUUID();
  const created = await db
    .insert(transactionsBancairesTable)
    .values(parsed.map((t) => ({
      licenceId,
      dateOperation: t.dateOperation,
      libelle: t.libelle,
      montant: t.montant.toString(),
      reference: t.reference,
      importBatchId,
    })))
    .returning();

  let rapprochees = 0;
  for (const tx of created) {
    const matched = await tryAutoMatch(licenceId, tx.id, Number(tx.montant));
    if (matched) rapprochees++;
  }

  res.status(201).json({ importBatchId, total: created.length, rapprochees });
});

const rapprocherSchema = z.object({
  factureId: z.string().uuid().optional(),
  depenseId: z.string().uuid().optional(),
  ignore: z.boolean().optional(),
});

// Rapprochement manuel — pour les lignes que l'auto-matching n'a pas pu
// resoudre seul (montant ambigu ou absent des factures/depenses connues).
transactionsBancairesRouter.post("/:id/rapprocher", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = rapprocherSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }
  if (!parsed.data.factureId && !parsed.data.depenseId && !parsed.data.ignore) {
    res.status(400).json({ error: "Precisez factureId, depenseId ou ignore" });
    return;
  }

  const [tx] = await db
    .select()
    .from(transactionsBancairesTable)
    .where(and(eq(transactionsBancairesTable.id, req.params.id), eq(transactionsBancairesTable.licenceId, licenceId)))
    .limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction introuvable" });
    return;
  }

  if (parsed.data.ignore) {
    const [updated] = await db
      .update(transactionsBancairesTable)
      .set({ rapprochementStatut: "IGNORE" })
      .where(eq(transactionsBancairesTable.id, tx.id))
      .returning();
    res.json(updated);
    return;
  }

  if (parsed.data.factureId) {
    const [facture] = await db.select().from(facturesTable).where(and(eq(facturesTable.id, parsed.data.factureId), eq(facturesTable.licenceId, licenceId))).limit(1);
    if (!facture) {
      res.status(404).json({ error: "Facture introuvable" });
      return;
    }
    await db.update(facturesTable).set({ statut: "PAYEE", datePaiement: new Date(), updatedAt: new Date() }).where(eq(facturesTable.id, facture.id));
    const [updated] = await db
      .update(transactionsBancairesTable)
      .set({ rapprochementStatut: "RAPPROCHE_MANUEL", factureId: facture.id })
      .where(eq(transactionsBancairesTable.id, tx.id))
      .returning();
    res.json(updated);
    return;
  }

  const [depense] = await db.select().from(depensesTable).where(and(eq(depensesTable.id, parsed.data.depenseId!), eq(depensesTable.licenceId, licenceId))).limit(1);
  if (!depense) {
    res.status(404).json({ error: "Depense introuvable" });
    return;
  }
  await db.update(depensesTable).set({ statut: "PAYEE", datePaiement: new Date(), updatedAt: new Date() }).where(eq(depensesTable.id, depense.id));
  const [updated] = await db
    .update(transactionsBancairesTable)
    .set({ rapprochementStatut: "RAPPROCHE_MANUEL", depenseId: depense.id })
    .where(eq(transactionsBancairesTable.id, tx.id))
    .returning();
  res.json(updated);
});

// Annule un rapprochement (erreur d'appariement) : ne revient PAS sur le
// statut PAYEE de la facture/depense liee (decision metier separee), efface
// seulement le lien cote transaction pour permettre un nouveau rapprochement.
transactionsBancairesRouter.post("/:id/annuler-rapprochement", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [updated] = await db
    .update(transactionsBancairesTable)
    .set({ rapprochementStatut: "NON_RAPPROCHE", factureId: null, depenseId: null })
    .where(and(eq(transactionsBancairesTable.id, req.params.id), eq(transactionsBancairesTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Transaction introuvable" });
    return;
  }
  res.json(updated);
});
