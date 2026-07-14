import { pgTable, uuid, text, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { materiauxIniesTable } from "./materiauxInies.js";

// Categories simplifiees de bilan carbone chantier (inspirees de la methode
// Bilan Carbone ADEME, sans la complexite des scopes 1/2/3 complets — usage
// web uniquement, feature de reporting, pas un module operationnel quotidien).
export const categorieCarboneEnum = pgEnum("categorie_carbone", [
  "TRANSPORT",
  "MATERIAUX",
  "ENERGIE",
  "DECHETS",
  "AUTRE",
]);

// Une ligne = un poste d'emission sur un chantier. emissionsKgCo2 est calcule
// et fige a la creation (quantite x facteurEmissionKgCo2, voir routes/bilanCarbone.ts) :
// si le facteur d'emission de reference evolue plus tard, les lignes passees
// ne sont jamais recalculees retroactivement (coherent avec un historique de
// reporting, meme logique que les ecritures comptables immuables).
export const bilanCarboneTable = pgTable("bilan_carbone", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  categorie: categorieCarboneEnum("categorie").notNull(),
  // Materiau de bibliotheque a l'origine du pre-remplissage (tracabilite) —
  // null si la ligne a ete saisie librement, comme avant l'ajout de la
  // bibliotheque INIES.
  materiauIniesId: uuid("materiau_inies_id").references(() => materiauxIniesTable.id),
  poste: text("poste").notNull(),
  quantite: numeric("quantite", { precision: 12, scale: 2 }).notNull(),
  unite: text("unite").notNull(),
  facteurEmissionKgCo2: numeric("facteur_emission_kg_co2", { precision: 10, scale: 4 }).notNull(),
  emissionsKgCo2: numeric("emissions_kg_co2", { precision: 12, scale: 2 }).notNull(),
  dateOperation: date("date_operation").notNull(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
