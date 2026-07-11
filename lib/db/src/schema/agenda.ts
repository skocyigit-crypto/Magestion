import { pgTable, uuid, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { prospectsTable } from "./prospects.js";

export const agendaTypeEnum = pgEnum("agenda_type", [
  "RDV", "VISITE_CHANTIER", "APPEL", "REUNION", "SIGNATURE", "LIVRAISON", "RELANCE", "AUTRE",
]);
export const agendaStatutEnum = pgEnum("agenda_statut", [
  "PLANIFIE", "CONFIRME", "EN_COURS", "EFFECTUE", "ANNULE", "REPORTE",
]);
export const agendaPrioriteEnum = pgEnum("agenda_priorite", ["BASSE", "NORMALE", "HAUTE", "URGENTE"]);

export const agendaEventsTable = pgTable("agenda_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  prospectId: uuid("prospect_id").references(() => prospectsTable.id),
  titre: text("titre").notNull(),
  type: agendaTypeEnum("type").notNull().default("RDV"),
  statut: agendaStatutEnum("statut").notNull().default("PLANIFIE"),
  priorite: agendaPrioriteEnum("priorite").notNull().default("NORMALE"),
  dateHeure: timestamp("date_heure", { withTimezone: true }).notNull(),
  dureeMinutes: integer("duree_minutes").notNull().default(60),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
