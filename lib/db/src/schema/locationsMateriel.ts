import { pgTable, uuid, text, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

export const locationMaterielStatutEnum = pgEnum("location_materiel_statut", ["EN_COURS", "TERMINEE"]);

// Materiel loue aupres d'un fournisseur exterieur (nacelle, compacteur...) —
// distinct de stockItems (materiaux consommables) et vehicles (parc possede).
export const locationsMaterielTable = pgTable("locations_materiel", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  designation: text("designation").notNull(),
  fournisseur: text("fournisseur").notNull(),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin"),
  coutJournalierHt: numeric("cout_journalier_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  statut: locationMaterielStatutEnum("statut").notNull().default("EN_COURS"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
