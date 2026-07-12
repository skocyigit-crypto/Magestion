import { pgTable, uuid, text, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const clientTypeEnum = pgEnum("client_type", ["PARTICULIER", "PROFESSIONNEL"]);

// Registre client independant des chantiers : permet de centraliser les
// coordonnees (au lieu de les re-saisir a chaque devis/facture) et de suivre
// l'historique/risque d'impaye d'un meme client a travers plusieurs chantiers.
// Purement additif : projects.clientId est optionnel, le champ texte libre
// projects.client reste utilisable seul pour un chantier ponctuel sans fiche.
export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  type: clientTypeEnum("type").notNull().default("PARTICULIER"),
  nom: text("nom").notNull(),
  email: text("email"),
  telephone: text("telephone"),
  adresse: text("adresse"),
  codePostal: varchar("code_postal", { length: 10 }),
  ville: text("ville"),
  siret: varchar("siret", { length: 14 }),
  tvaIntracommunautaire: text("tva_intracommunautaire"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
