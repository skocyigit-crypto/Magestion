import { pgTable, uuid, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// Decoupage SPATIAL d'un chantier (ex: "Batiment A", "Batiment B", "VRD"),
// a distinguer de chantierPhases.ts qui est un decoupage TEMPOREL (Gantt,
// sequentiel). Plusieurs sous-chantiers peuvent avancer en parallele, chacun
// avec son propre budget et avancement — pas de dependance d'ordre entre eux.
export const sousChantierStatutEnum = pgEnum("sous_chantier_statut", [
  "EN_ATTENTE",
  "EN_COURS",
  "TERMINE",
  "SUSPENDU",
]);

export const sousChantiersTable = pgTable("sous_chantiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  nom: text("nom").notNull(),
  description: text("description"),
  budgetEstimeHt: numeric("budget_estime_ht", { precision: 12, scale: 2 }),
  avancementPercent: numeric("avancement_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  statut: sousChantierStatutEnum("statut").notNull().default("EN_ATTENTE"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
