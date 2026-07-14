import { pgTable, uuid, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { planComptableTable } from "./planComptable.js";

// Budget analytique annuel par compte (distinct du budget par chantier deja
// existant sur projects.budgetEstimeHt) : permet de comparer le realise
// (somme des ecritures du compte sur l'exercice, cf routes/budgetsPostes.ts)
// au montant budgete, compte par compte.
export const budgetsPostesTable = pgTable("budgets_postes", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  compteNum: text("compte_num")
    .notNull()
    .references(() => planComptableTable.compteNum),
  exercice: integer("exercice").notNull(),
  montantBudgeteHt: numeric("montant_budgete_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
