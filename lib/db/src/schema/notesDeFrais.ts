import { pgTable, uuid, text, numeric, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { employeesTable } from "./employees.js";
import { projectsTable } from "./projects.js";

export const noteFraisCategorieEnum = pgEnum("note_frais_categorie", [
  "DEPLACEMENT", "REPAS", "MATERIEL", "HEBERGEMENT", "AUTRE",
]);
// SOUMISE -> VALIDEE -> REMBOURSEE, ou SOUMISE/VALIDEE -> REFUSEE.
export const noteFraisStatutEnum = pgEnum("note_frais_statut", ["SOUMISE", "VALIDEE", "REMBOURSEE", "REFUSEE"]);

// Distinct de "depenses" (achats fournisseurs) : avance personnelle d'un
// employe a rembourser, pas une facture d'achat.
export const notesDeFraisTable = pgTable("notes_de_frais", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  dateDepense: date("date_depense").notNull(),
  categorie: noteFraisCategorieEnum("categorie").notNull().default("AUTRE"),
  motif: text("motif").notNull(),
  montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
  statut: noteFraisStatutEnum("statut").notNull().default("SOUMISE"),
  dateRemboursement: timestamp("date_remboursement", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
