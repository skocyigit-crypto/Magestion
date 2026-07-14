import { pgTable, uuid, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

// Bibliotheque de materiaux avec facteur d'emission de reference (base
// INIES/ADEME) : accelere la saisie du bilan carbone sans imposer de
// valeur — une ligne de bilan_carbone peut toujours etre saisie 100% a la
// main (materiauIniesId reste null dans ce cas, voir routes/bilanCarbone.ts).
export const materiauxIniesTable = pgTable("materiaux_inies", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  codeInies: text("code_inies"),
  designation: text("designation").notNull(),
  categorie: text("categorie").notNull().default("gros_oeuvre"),
  sousCategorie: text("sous_categorie"),
  uniteFonctionnelle: text("unite_fonctionnelle").notNull(),
  emissionCo2Kg: numeric("emission_co2_kg", { precision: 12, scale: 4 }).notNull(),
  source: text("source").notNull().default("INIES"),
  dureeVieAns: integer("duree_vie_ans"),
  densiteKgM3: numeric("densite_kg_m3", { precision: 10, scale: 2 }),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
