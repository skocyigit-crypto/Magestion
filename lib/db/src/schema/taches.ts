import { pgTable, uuid, text, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { employeesTable } from "./employees.js";

export const tachePrioriteEnum = pgEnum("tache_priorite", ["BASSE", "NORMALE", "HAUTE", "URGENTE"]);
export const tacheStatutEnum = pgEnum("tache_statut", ["A_FAIRE", "EN_COURS", "TERMINEE", "ANNULEE"]);

export const tachesTable = pgTable("taches", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  titre: text("titre").notNull(),
  description: text("description"),
  priorite: tachePrioriteEnum("priorite").notNull().default("NORMALE"),
  statut: tacheStatutEnum("statut").notNull().default("A_FAIRE"),
  projectId: uuid("project_id").references(() => projectsTable.id),
  assigneId: uuid("assigne_id").references(() => employeesTable.id),
  echeance: date("echeance"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
