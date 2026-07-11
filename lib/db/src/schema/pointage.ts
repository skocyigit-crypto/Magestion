import { pgTable, uuid, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { employeesTable } from "./employees.js";
import { projectsTable } from "./projects.js";

export const pointageTable = pgTable("pointage", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  dateJour: date("date_jour").notNull().defaultNow(),
  heureArrivee: timestamp("heure_arrivee", { withTimezone: true }).notNull().defaultNow(),
  heureDepart: timestamp("heure_depart", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});
