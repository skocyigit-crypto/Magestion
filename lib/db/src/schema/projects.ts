import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const projectCategorieEnum = pgEnum("project_categorie", [
  "RENOVATION",
  "CONSTRUCTION_NEUVE",
  "ISOLATION",
  "EXTENSION",
  "AUTRE",
]);

export const projectStatutEnum = pgEnum("project_statut", [
  "EN_ATTENTE",
  "EN_COURS",
  "TERMINE",
  "SUSPENDU",
]);

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  client: text("client").notNull(),
  adresse: text("adresse"),
  codePostal: varchar("code_postal", { length: 10 }),
  budgetEstimeHt: numeric("budget_estime_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  objectifMargePercent: numeric("objectif_marge_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  categorie: projectCategorieEnum("categorie").notNull().default("AUTRE"),
  statut: projectStatutEnum("statut").notNull().default("EN_ATTENTE"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
