import { pgTable, uuid, text, integer, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const etapeClotureStatutEnum = pgEnum("etape_cloture_statut", ["A_FAIRE", "EN_COURS", "FAIT", "BLOQUE"]);

// Checklist standard de cloture d'exercice comptable, auto-generee (voir
// ensureEtapes() dans routes/clotureComptable.ts) au premier acces pour un
// exercice donne — pas de creation manuelle d'etape, seul le statut/notes
// se modifient (voir PATCH). Un exercice = une annee civile ("2026").
export const etapesClotureTable = pgTable("etapes_cloture", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  exercice: varchar("exercice", { length: 4 }).notNull(),
  ordre: integer("ordre").notNull(),
  titre: text("titre").notNull(),
  description: text("description"),
  obligatoire: boolean("obligatoire").notNull().default(true),
  statut: etapeClotureStatutEnum("statut").notNull().default("A_FAIRE"),
  dateRealisation: timestamp("date_realisation", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
