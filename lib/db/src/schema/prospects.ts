import { pgTable, uuid, text, varchar, numeric, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

// Pipeline Kanban standard du secteur BTP (cf. gap-analyse concurrents) :
// Nouveau -> Contacte -> RDV planifie -> Devis envoye -> Negociation -> Gagne/Perdu.
export const prospectStatutEnum = pgEnum("prospect_statut", [
  "NOUVEAU",
  "CONTACTE",
  "RDV_PLANIFIE",
  "DEVIS_ENVOYE",
  "NEGOCIATION",
  "GAGNE",
  "PERDU",
]);

export const prospectUrgenceEnum = pgEnum("prospect_urgence", ["BASSE", "NORMALE", "URGENTE", "TRES_URGENTE"]);

export const prospectsTable = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  contact: text("contact"),
  telephone: varchar("telephone", { length: 30 }),
  email: text("email"),
  adresse: text("adresse"),
  codePostal: varchar("code_postal", { length: 10 }),
  budgetEstime: numeric("budget_estime", { precision: 12, scale: 2 }).notNull().default("0"),
  distanceKm: numeric("distance_km", { precision: 6, scale: 1 }),
  urgence: prospectUrgenceEnum("urgence").notNull().default("NORMALE"),
  statut: prospectStatutEnum("statut").notNull().default("NOUVEAU"),
  score: integer("score").notNull().default(50),
  notes: text("notes"),
  consentementRgpd: boolean("consentement_rgpd").notNull().default(false),
  consentementDate: timestamp("consentement_date", { withTimezone: true }),
  // Irreversible (droit a l'effacement RGPD) — voir routes/rgpd.ts. Aucun
  // champ identifiant n'est jamais restaure une fois anonymise=true.
  anonymise: boolean("anonymise").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
