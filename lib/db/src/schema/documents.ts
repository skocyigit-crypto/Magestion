import { pgTable, uuid, text, integer, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const documentTypeEnum = pgEnum("document_type", ["CONTRAT", "ASSURANCE", "PERMIS", "FACTURE", "PLAN", "AUTRE"]);
export const documentEntityTypeEnum = pgEnum("document_entity_type", [
  "PROJECT", "EMPLOYEE", "VEHICLE", "SOUS_TRAITANT", "GENERAL",
]);

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  type: documentTypeEnum("type").notNull().default("AUTRE"),
  entityType: documentEntityTypeEnum("entity_type").notNull().default("GENERAL"),
  entityId: uuid("entity_id"),
  cheminFichier: text("chemin_fichier").notNull(),
  tailleOctets: integer("taille_octets").notNull().default(0),
  mimeType: text("mime_type"),
  dateExpiration: date("date_expiration"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
