import { pgTable, uuid, integer, numeric, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// BROUILLON = modifiable ; VALIDEE = verrouillee (immutabilite financiere,
// meme regle que factures). Pas de flux au-dela (l'emission facture separee
// reste a faire en Phase 2 suite).
export const situationStatutEnum = pgEnum("situation_statut", ["BROUILLON", "VALIDEE"]);

export const situationsTable = pgTable("situations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  numeroSituation: integer("numero_situation").notNull(),
  marcheHt: numeric("marche_ht", { precision: 12, scale: 2 }).notNull(),
  avancementPercent: numeric("avancement_percent", { precision: 5, scale: 2 }).notNull(),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  tauxRetenueGarantie: numeric("taux_retenue_garantie", { precision: 4, scale: 2 }).notNull().default("5"),
  statut: situationStatutEnum("statut").notNull().default("BROUILLON"),
  dateSituation: date("date_situation").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
