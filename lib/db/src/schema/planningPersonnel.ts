import { pgTable, uuid, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { employeesTable } from "./employees.js";
import { projectsTable } from "./projects.js";

export const affectationTypeEnum = pgEnum("affectation_type", [
  "CHANTIER",
  "CONGE",
  "MALADIE",
  "FORMATION",
  "DEPLACEMENT",
  "REPOS",
  "BUREAU",
]);

// chefEquipe est PAR AFFECTATION (pas un role permanent sur l'employe) — gap
// identifie face aux logiciels concurrents (chef d'equipe change selon le chantier).
export const planningAffectationsTable = pgTable("planning_affectations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  date: date("date").notNull(),
  type: affectationTypeEnum("type").notNull().default("CHANTIER"),
  chefEquipe: boolean("chef_equipe").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
