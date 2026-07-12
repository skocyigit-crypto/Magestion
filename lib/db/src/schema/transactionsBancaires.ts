import { pgTable, uuid, text, numeric, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { facturesTable } from "./factures.js";
import { depensesTable } from "./depenses.js";

// NON_RAPPROCHE : importee, aucun rapprochement trouve (revue manuelle).
// RAPPROCHE_AUTO : montant unique correspondant a une facture/depense en
// attente de paiement -> rapprochee et facture/depense marquee PAYEE.
// RAPPROCHE_MANUEL : rapprochee explicitement par un utilisateur.
// IGNORE : ecartee volontairement (frais bancaires, virement interne...) —
// alternative au hard-delete pour les lignes non pertinentes.
export const rapprochementStatutEnum = pgEnum("rapprochement_statut", [
  "NON_RAPPROCHE", "RAPPROCHE_AUTO", "RAPPROCHE_MANUEL", "IGNORE",
]);

export const transactionsBancairesTable = pgTable("transactions_bancaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  dateOperation: date("date_operation").notNull(),
  libelle: text("libelle").notNull(),
  // Signe : positif = encaissement (credit), negatif = paiement (debit).
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
  reference: text("reference"),
  // Regroupe les lignes d'un meme fichier importe (traçabilite de l'origine).
  importBatchId: uuid("import_batch_id").notNull(),
  rapprochementStatut: rapprochementStatutEnum("rapprochement_statut").notNull().default("NON_RAPPROCHE"),
  factureId: uuid("facture_id").references(() => facturesTable.id),
  depenseId: uuid("depense_id").references(() => depensesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
