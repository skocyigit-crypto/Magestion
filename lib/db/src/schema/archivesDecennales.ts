import { pgTable, uuid, text, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { sousTraitantsTable } from "./sousTraitants.js";
import { documentsTable } from "./documents.js";

// Registre des attestations d'assurance decennale par (chantier, sous-traitant) :
// obligation legale BTP de conservation 10 ans. Le fichier de l'attestation
// est stocke via la table documents existante (documentId), pas en base64
// inline comme dans le projet de reference : evite de gonfler la table pour
// des PDF qui peuvent faire plusieurs Mo.
export const archivesDecennalesTable = pgTable("archives_decennales", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  sousTraitantId: uuid("sous_traitant_id")
    .notNull()
    .references(() => sousTraitantsTable.id),
  numeroAttestation: text("numero_attestation").notNull(),
  assureur: text("assureur").notNull(),
  activiteCouverte: text("activite_couverte"),
  dateDebutValidite: date("date_debut_validite").notNull(),
  dateFinValidite: date("date_fin_validite").notNull(),
  documentId: uuid("document_id").references(() => documentsTable.id),
  dateDroc: date("date_droc"),
  dateCloture: date("date_cloture"),
  // Une fois l'exercice/chantier clos, l'archive est scellee : plus aucune
  // modification possible (regle legale de conservation, meme logique que le
  // verrouillage WORM des documents).
  scelle: boolean("scelle").notNull().default(false),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
