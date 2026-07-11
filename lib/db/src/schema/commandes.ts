import { pgTable, uuid, text, numeric, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// Brouillon -> Envoyee -> Confirmee -> Livree.
export const commandeStatutEnum = pgEnum("commande_statut", ["BROUILLON", "ENVOYEE", "CONFIRMEE", "LIVREE"]);

export const commandesTable = pgTable("commandes", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  fournisseur: text("fournisseur").notNull(),
  objet: text("objet").notNull(),
  statut: commandeStatutEnum("statut").notNull().default("BROUILLON"),
  montantHt: numeric("montant_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  dateLivraisonPrevue: date("date_livraison_prevue"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
