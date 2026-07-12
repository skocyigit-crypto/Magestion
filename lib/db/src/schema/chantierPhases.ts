import { pgTable, uuid, text, integer, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// Planning Gantt simplifie par chantier : phases sequencees dans le temps,
// sans graphe de dependances (v1) — l'ordre visuel vient de dateDebut, "ordre"
// ne sert qu'a departager deux phases demarrant le meme jour.
export const chantierPhasesTable = pgTable("chantier_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  nom: text("nom").notNull(),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin").notNull(),
  avancementPercent: numeric("avancement_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  ordre: integer("ordre").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
