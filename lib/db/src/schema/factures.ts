import { pgTable, uuid, text, numeric, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { devisTable } from "./devis.js";

// Immutabilite : au-dela de BROUILLON, montantHt/tauxTva/objet ne sont plus
// modifiables server-side (regle produit : "modification facture verrouillee
// une fois validee ou payee"). ENVOYEE = validee/verrouillee.
export const factureStatutEnum = pgEnum("facture_statut", ["BROUILLON", "ENVOYEE", "PAYEE", "EN_RETARD"]);

export const facturesTable = pgTable("factures", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  devisId: uuid("devis_id").references(() => devisTable.id),
  numero: text("numero").notNull(),
  client: text("client").notNull(),
  objet: text("objet").notNull(),
  statut: factureStatutEnum("statut").notNull().default("BROUILLON"),
  montantHt: numeric("montant_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  dateEcheance: date("date_echeance"),
  datePaiement: timestamp("date_paiement", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
