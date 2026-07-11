import { pgTable, uuid, text, varchar, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const sousTraitantsTable = pgTable("sous_traitants", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  raisonSociale: text("raison_sociale").notNull(),
  siret: varchar("siret", { length: 14 }).notNull(),
  specialite: text("specialite"),
  contact: text("contact"),
  telephone: varchar("telephone", { length: 30 }),
  email: text("email"),
  assuranceDecennaleValidite: date("assurance_decennale_validite"),
  urssafValidite: date("urssaf_validite"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
