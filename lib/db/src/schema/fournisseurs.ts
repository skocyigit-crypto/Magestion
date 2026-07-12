import { pgTable, uuid, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

// Registre fournisseur centralise (materiaux/prestations, distinct des
// sous-traitants — voir schema/sousTraitants.ts pour la main d'oeuvre
// sous-traitee avec suivi de conformite assurance/URSSAF). Purement additif :
// commandes.fournisseurId / depenses.fournisseurId sont optionnels, le champ
// texte libre "fournisseur" existant reste utilisable seul.
export const fournisseursTable = pgTable("fournisseurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  email: text("email"),
  telephone: text("telephone"),
  adresse: text("adresse"),
  codePostal: varchar("code_postal", { length: 10 }),
  ville: text("ville"),
  siret: varchar("siret", { length: 14 }),
  tvaIntracommunautaire: text("tva_intracommunautaire"),
  iban: text("iban"),
  bic: text("bic"),
  conditionsPaiement: text("conditions_paiement"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
