import { pgTable, uuid, text, varchar, integer, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { fournisseursTable } from "./fournisseurs.js";

export const immobilisationCategorieEnum = pgEnum("immobilisation_categorie", [
  "MATERIEL", "VEHICULE", "INFORMATIQUE", "MOBILIER", "OUTILLAGE", "AUTRE",
]);
export const immobilisationStatutEnum = pgEnum("immobilisation_statut", ["EN_SERVICE", "CEDE", "REBUT"]);

// amortissementCumule/valeurNetteComptable/dotationAnnuelle ne sont PAS
// stockes : calcules a la volee a chaque lecture depuis valeurAcquisition/
// dureeAmortissement/dateMiseEnService (voir lib/amortissement.ts) — evite
// toute staleness, pas de bouton "recalculer" necessaire.
export const immobilisationsTable = pgTable("immobilisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  code: text("code").notNull(),
  designation: text("designation").notNull(),
  categorie: immobilisationCategorieEnum("categorie").notNull().default("AUTRE"),
  compteComptable: varchar("compte_comptable", { length: 10 }).notNull().default("2154"),
  dateAcquisition: date("date_acquisition").notNull(),
  dateMiseEnService: date("date_mise_en_service"),
  valeurAcquisition: numeric("valeur_acquisition", { precision: 12, scale: 2 }).notNull().default("0"),
  dureeAmortissement: integer("duree_amortissement").notNull().default(5),
  fournisseurId: uuid("fournisseur_id").references(() => fournisseursTable.id),
  localisation: text("localisation"),
  affecteA: text("affecte_a"),
  statut: immobilisationStatutEnum("statut").notNull().default("EN_SERVICE"),
  dateCession: date("date_cession"),
  valeurCession: numeric("valeur_cession", { precision: 12, scale: 2 }),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
