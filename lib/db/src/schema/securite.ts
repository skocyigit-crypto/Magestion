import { pgTable, uuid, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

export const incidentGraviteEnum = pgEnum("incident_gravite", ["FAIBLE", "MOYENNE", "ELEVEE", "CRITIQUE"]);

export const securiteIncidentsTable = pgTable("securite_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  titre: text("titre").notNull(),
  description: text("description"),
  typeIncident: text("type_incident").notNull(),
  gravite: incidentGraviteEnum("gravite").notNull().default("FAIBLE"),
  dateIncident: timestamp("date_incident", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
