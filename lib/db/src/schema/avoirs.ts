import { pgTable, uuid, text, numeric, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { facturesTable } from "./factures.js";

// Avoir (note de credit) : toujours emis contre une facture deja EMISE
// (jamais un brouillon — corriger un brouillon se fait en le modifiant
// directement). BROUILLON -> EMIS genere l'ecriture comptable inverse de la
// facture (voir lib/journalEntry.ts recordAvoirEmission) et verrouille le contenu.
export const avoirStatutEnum = pgEnum("avoir_statut", ["BROUILLON", "EMIS"]);

export const avoirsTable = pgTable("avoirs", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  factureId: uuid("facture_id")
    .notNull()
    .references(() => facturesTable.id),
  numero: text("numero").notNull(),
  motif: text("motif").notNull(),
  montantHt: numeric("montant_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  statut: avoirStatutEnum("statut").notNull().default("BROUILLON"),
  dateEmission: timestamp("date_emission", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const avoirLignesTable = pgTable("avoir_lignes", {
  id: uuid("id").primaryKey().defaultRandom(),
  avoirId: uuid("avoir_id")
    .notNull()
    .references(() => avoirsTable.id),
  ordre: integer("ordre").notNull().default(0),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
  unite: text("unite").notNull().default("u"),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  remisePercent: numeric("remise_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
