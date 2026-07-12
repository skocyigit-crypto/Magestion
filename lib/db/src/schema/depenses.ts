import { pgTable, uuid, text, numeric, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { fournisseursTable } from "./fournisseurs.js";

export const depenseCategorieEnum = pgEnum("depense_categorie", [
  "MATERIAUX",
  "MAIN_OEUVRE",
  "SOUS_TRAITANCE",
  "MATERIEL",
  "ADMINISTRATIF",
  "AUTRE",
]);

// A_VALIDER -> BON_A_PAYER -> PAYEE, ou A_VALIDER/BON_A_PAYER -> EN_LITIGE.
export const depenseStatutEnum = pgEnum("depense_statut", ["A_VALIDER", "BON_A_PAYER", "PAYEE", "EN_LITIGE"]);

export const depensesTable = pgTable("depenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  fournisseur: text("fournisseur").notNull(),
  fournisseurId: uuid("fournisseur_id").references(() => fournisseursTable.id),
  categorie: depenseCategorieEnum("categorie").notNull().default("AUTRE"),
  objet: text("objet").notNull(),
  statut: depenseStatutEnum("statut").notNull().default("A_VALIDER"),
  montantHt: numeric("montant_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  // TVA autoliquidation (art. 283-2 nonies CGI, sous-traitance BTP) : le
  // sous-traitant facture HT, l'entreprise autoliquide la TVA (44566 debit +
  // 44571 credit, double mouvement N8) au lieu de la payer au fournisseur.
  autoliquidation: boolean("autoliquidation").notNull().default(false),
  dateEcheance: date("date_echeance"),
  datePaiement: timestamp("date_paiement", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
