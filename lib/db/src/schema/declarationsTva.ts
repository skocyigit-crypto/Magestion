import { pgTable, uuid, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const declarationTvaStatutEnum = pgEnum("declaration_tva_statut", ["BROUILLON", "VALIDEE"]);

// Snapshot d'une periode de declaration de TVA — les montants sont figes a
// la validation (VALIDEE), meme si de nouvelles ecritures arrivent ensuite
// sur la periode (comme les situations/factures : verrouillage definitif).
export const declarationsTvaTable = pgTable("declarations_tva", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  periodeDebut: date("periode_debut").notNull(),
  periodeFin: date("periode_fin").notNull(),
  tvaCollectee: numeric("tva_collectee", { precision: 12, scale: 2 }).notNull(),
  tvaDeductible: numeric("tva_deductible", { precision: 12, scale: 2 }).notNull(),
  tvaAPayer: numeric("tva_a_payer", { precision: 12, scale: 2 }).notNull(),
  statut: declarationTvaStatutEnum("statut").notNull().default("BROUILLON"),
  dateValidation: timestamp("date_validation", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
