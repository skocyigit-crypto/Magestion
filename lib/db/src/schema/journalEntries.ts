import { pgTable, uuid, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { planComptableTable } from "./planComptable.js";

// Ecritures comptables en partie double. Plusieurs lignes (meme ecritureNum +
// pieceRef) forment UNE ecriture equilibree (somme debit = somme credit) —
// generees automatiquement a l'emission d'une facture (VE) ou la creation
// d'une depense (AC), jamais modifiees ensuite (immutabilite comptable).
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  journalCode: text("journal_code").notNull(), // AC | VE | OD
  ecritureNum: integer("ecriture_num").notNull(),
  ecritureDate: date("ecriture_date").notNull().defaultNow(),
  compteNum: text("compte_num")
    .notNull()
    .references(() => planComptableTable.compteNum),
  compteLib: text("compte_lib").notNull(),
  pieceRef: text("piece_ref").notNull(),
  pieceDate: date("piece_date").notNull().defaultNow(),
  ecritureLib: text("ecriture_lib").notNull(),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  sourceType: text("source_type").notNull(), // FACTURE | DEPENSE
  sourceId: uuid("source_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
