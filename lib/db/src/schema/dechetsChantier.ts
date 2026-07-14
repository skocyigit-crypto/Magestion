import { pgTable, uuid, text, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { fournisseursTable } from "./fournisseurs.js";

// Classification reglementaire francaise des dechets de chantier (diagnostic
// dechets obligatoire depuis 2022 pour les demolitions/renovations lourdes).
export const typeDechetEnum = pgEnum("type_dechet", ["INERTES", "NON_DANGEREUX_NON_INERTES", "DANGEREUX"]);

export const destinationDechetEnum = pgEnum("destination_dechet", [
  "REEMPLOI",
  "RECYCLAGE",
  "VALORISATION_ENERGETIQUE",
  "ELIMINATION",
  "STOCKAGE",
]);

// Une ligne = un enlevement de dechets sur un chantier, tracee via bordereau
// (BSD/BSDD obligatoire pour les dechets DANGEREUX, art. R541-45 code
// environnement). Le collecteur peut etre un fournisseur enregistre ou un
// texte libre (entreprise de collecte ponctuelle sans fiche).
export const dechetsChantierTable = pgTable("dechets_chantier", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  typeDechet: typeDechetEnum("type_dechet").notNull(),
  natureDechet: text("nature_dechet").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull(),
  unite: text("unite").notNull().default("tonnes"),
  collecteur: text("collecteur"),
  fournisseurId: uuid("fournisseur_id").references(() => fournisseursTable.id),
  dateEnlevement: date("date_enlevement").notNull(),
  destination: destinationDechetEnum("destination").notNull().default("RECYCLAGE"),
  // Obligatoire legalement pour les dechets DANGEREUX, facultatif sinon.
  bordereauNumero: text("bordereau_numero"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
