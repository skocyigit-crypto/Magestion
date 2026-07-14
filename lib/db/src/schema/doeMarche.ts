import { pgTable, uuid, integer, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { marchesPublicsTable } from "./marchesPublics.js";
import { documentsTable } from "./documents.js";

export const doeStatutEnum = pgEnum("doe_statut", ["FINALISE", "SUPERSEDED"]);

// DOE - Dossier des Ouvrages Executes (livre au MOA en fin de chantier).
// Une ligne = une version FINALISEE du DOE pour un marche donne. Les
// brouillons/apercus ne sont jamais persistes ici (generation a la volee,
// retour direct du PDF) : cette table n'a donc pas d'updatedAt, seulement
// createdAt (append-only). Le fichier fusionne est stocke via la table
// documents existante (entityType MARCHE_PUBLIC), pas re-invente ici.
export const doeMarcheTable = pgTable("doe_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  version: integer("version").notNull().default(1),
  statut: doeStatutEnum("statut").notNull().default("FINALISE"),
  documentId: uuid("document_id").references(() => documentsTable.id),
  sectionsSnapshot: jsonb("sections_snapshot").$type<
    Array<{ key: string; label: string; sourceTable?: string; sourceId?: string; skipped?: boolean; skipReason?: string }>
  >().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
