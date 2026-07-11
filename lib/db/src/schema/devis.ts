import { pgTable, uuid, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// Flux impose : Brouillon -> Envoye -> Accepte / Refuse (regle produit).
export const devisStatutEnum = pgEnum("devis_statut", ["BROUILLON", "ENVOYE", "ACCEPTE", "REFUSE"]);

export const devisTable = pgTable("devis", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  numero: text("numero").notNull(),
  client: text("client").notNull(),
  objet: text("objet").notNull(),
  statut: devisStatutEnum("statut").notNull().default("BROUILLON"),
  montantHt: numeric("montant_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  dateEnvoi: timestamp("date_envoi", { withTimezone: true }),
  dateReponse: timestamp("date_reponse", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
