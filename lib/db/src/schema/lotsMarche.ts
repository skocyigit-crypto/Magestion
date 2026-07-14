import { pgTable, uuid, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { marchesPublicsTable } from "./marchesPublics.js";
import { clientsTable } from "./clients.js";

export const lotMarcheStatutEnum = pgEnum("lot_marche_statut", [
  "A_ATTRIBUER",
  "ATTRIBUE",
  "INFRUCTUEUX",
  "TERMINE",
]);

// Allotissement (CCP art. L.2113-10) : un marche public est obligatoirement
// divise en lots sauf derogation motivee. Chaque lot peut etre attribue a une
// entreprise differente.
export const lotsMarcheTable = pgTable("lots_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  numeroLot: text("numero_lot").notNull(),
  intitule: text("intitule").notNull(),
  corpsMetier: text("corps_metier"),
  montantEstimeHt: numeric("montant_estime_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  montantAttribueHt: numeric("montant_attribue_ht", { precision: 14, scale: 2 }).default("0"),
  attributaireClientId: uuid("attributaire_client_id").references(() => clientsTable.id),
  statut: lotMarcheStatutEnum("statut").notNull().default("A_ATTRIBUER"),
  dateAttribution: timestamp("date_attribution", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
