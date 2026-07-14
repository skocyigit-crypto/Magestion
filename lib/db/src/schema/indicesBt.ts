import { pgTable, uuid, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

// Indices BT/TP (revision de prix des marches publics, INSEE). Reference pure
// (append-only, pas d'updatedAt) : chaque publication mensuelle d'un indice
// est une nouvelle ligne, jamais une correction retroactive.
export const indicesBtTable = pgTable("indices_bt", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  code: text("code").notNull(),
  libelle: text("libelle").notNull(),
  periode: text("periode").notNull(),
  valeur: numeric("valeur", { precision: 10, scale: 4 }).notNull(),
  datePublication: date("date_publication"),
  source: text("source").default("INSEE"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
