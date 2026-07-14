import { pgTable, uuid, text, numeric, integer, date, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { clientsTable } from "./clients.js";
import { marchesPublicsTable } from "./marchesPublics.js";

export const procedureTypeEnum = pgEnum("procedure_type", [
  "MAPA",
  "AOO",
  "AOR",
  "DIALOGUE_COMPETITIF",
  "NEGOCIEE",
]);

// Pipeline veille -> candidature -> (si gagne) marche, en une seule table :
// contrairement au projet de reference (appels_offres + candidatures_mp
// separes), une meme opportunite de marche public n'a jamais besoin d'etre
// suivie sous deux fiches distinctes ici (regle produit Magestion : moins de
// tables, un statut qui avance).
export const appelOffreStatutEnum = pgEnum("appel_offre_statut", [
  "VEILLE",
  "EN_PREPARATION",
  "DEPOSE",
  "RETENU",
  "REJETE",
  "GAGNE",
  "PERDU",
]);

export const appelsOffresTable = pgTable("appels_offres", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  reference: text("reference"),
  intitule: text("intitule").notNull(),
  organisme: text("organisme"),
  // Acheteur public deja connu en fiche client (facultatif : une premiere
  // veille n'a souvent pas encore de fiche client associee).
  clientId: uuid("client_id").references(() => clientsTable.id),
  typeProcedure: procedureTypeEnum("type_procedure").notNull().default("MAPA"),
  datePublication: date("date_publication"),
  dateLimiteDepot: timestamp("date_limite_depot", { withTimezone: true }),
  lieu: text("lieu"),
  categorie: text("categorie"),
  montantEstimeHt: numeric("montant_estime_ht", { precision: 14, scale: 2 }),
  montantOffreHt: numeric("montant_offre_ht", { precision: 14, scale: 2 }),
  delaiProposeJours: integer("delai_propose_jours"),
  statut: appelOffreStatutEnum("statut").notNull().default("VEILLE"),
  motifRejet: text("motif_rejet"),
  // Renseigne uniquement quand statut passe a GAGNE (voir routes/marchesPublics.ts).
  marcheId: uuid("marche_id").references(() => marchesPublicsTable.id),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
