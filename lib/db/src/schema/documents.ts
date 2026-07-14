import { pgTable, uuid, text, integer, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { usersTable } from "./users.js";

export const documentTypeEnum = pgEnum("document_type", ["CONTRAT", "ASSURANCE", "PERMIS", "FACTURE", "PLAN", "AUTRE"]);
export const documentEntityTypeEnum = pgEnum("document_entity_type", [
  "PROJECT", "EMPLOYEE", "VEHICLE", "SOUS_TRAITANT", "GENERAL", "APPEL_OFFRE", "MARCHE_PUBLIC",
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
  // Verrouillage WORM : au-dela de ce point, plus aucune metadonnee ni le
  // fichier physique ne sont modifiables (voir routes/documents.ts). Pas de
  // deverrouillage possible — c'est le sens meme de "Write Once Read Many"
  // pour les documents a valeur legale (contrats signes, assurances...).
  verrouille: boolean("verrouille").notNull().default(false),
  verrouilleAt: timestamp("verrouille_at", { withTimezone: true }),
  verrouillePar: uuid("verrouille_par").references(() => usersTable.id),
  hashSha256: text("hash_sha256"),
  // true si le type/nom ont ete suggeres par l'IA (OCR) plutot que saisis
  // manuellement — affiche a titre informatif, jamais bloquant.
  classificationIa: boolean("classification_ia").notNull().default(false),
  // Zone Privee : reserve aux roles SUPER_ADMIN/COMPTABILITE (voir routes/documents.ts).
  // Un document confidentiel n'apparait pas dans la liste et ne peut pas etre
  // telecharge/modifie par TERRAIN/COMMERCIAL, meme s'ils sont l'auteur de l'upload.
  confidentiel: boolean("confidentiel").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
