import { pgTable, uuid, text, numeric, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { clientsTable } from "./clients.js";
import { projectsTable } from "./projects.js";
import { devisTable } from "./devis.js";

export const marcheTypeEnum = pgEnum("marche_type", ["TRAVAUX", "SERVICES", "FOURNITURES"]);
export const marcheStatutEnum = pgEnum("marche_statut", ["EN_COURS", "TERMINE", "RESILIE", "SUSPENDU"]);

// Marche public notifie (gagne). Cree soit directement, soit via le passage
// EN_PREPARATION -> GAGNE d'un appel_offre (voir routes/appelsOffres.ts).
export const marchesPublicsTable = pgTable("marches_publics", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  numero: text("numero").notNull(),
  intitule: text("intitule").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientsTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  devisId: uuid("devis_id").references(() => devisTable.id),
  typeMarche: marcheTypeEnum("type_marche").notNull().default("TRAVAUX"),
  procedureType: text("procedure_type").notNull().default("MAPA"),
  montantInitialHt: numeric("montant_initial_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  // Tenu a jour a chaque avenant IMPUTE (voir routes/marchesPublics.ts) : montant
  // initial + somme des avenants imputes. Sert de base au calcul du DGD.
  montantActuelHt: numeric("montant_actuel_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20"),
  dateNotification: timestamp("date_notification", { withTimezone: true }),
  dateDebutTravaux: timestamp("date_debut_travaux", { withTimezone: true }),
  dateFinPrevue: timestamp("date_fin_prevue", { withTimezone: true }),
  dateReception: timestamp("date_reception", { withTimezone: true }),
  delaiExecutionMois: integer("delai_execution_mois"),
  clauseRevisionPrix: boolean("clause_revision_prix").notNull().default(false),
  // Code indices_bt.code de reference pour la formule de revision, et valeur
  // de l'indice au mois zero (fige a la notification, jamais recalcule).
  indiceReference: text("indice_reference"),
  valeurIndiceMoisZero: numeric("valeur_indice_mois_zero", { precision: 10, scale: 4 }),
  partFixePourcent: numeric("part_fixe_pourcent", { precision: 5, scale: 2 }).default("15"),
  cautionDefinitivePourcent: numeric("caution_definitive_pourcent", { precision: 5, scale: 2 }).default("5"),
  retenueGarantiePourcent: numeric("retenue_garantie_pourcent", { precision: 5, scale: 2 }).default("5"),
  delaiGarantieMois: integer("delai_garantie_mois").default(12),
  penalitesRetardJour: numeric("penalites_retard_jour", { precision: 10, scale: 2 }),
  plafondPenalitesPourcent: numeric("plafond_penalites_pourcent", { precision: 5, scale: 2 }).default("5"),
  statut: marcheStatutEnum("statut").notNull().default("EN_COURS"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const avenantTypeEnum = pgEnum("avenant_type", [
  "REVISION_PRIX",
  "TRAVAUX_SUPPLEMENTAIRES",
  "PROLONGATION_DELAI",
  "AUTRE",
]);

// Statut unique BROUILLON -> SIGNE -> TRANSMIS -> IMPUTE : simplification du
// projet de reference qui suit 3 booleens independants (signe/transmis/impute).
// Ici l'ordre est toujours strictement sequentiel en pratique, un statut
// suffit (meme logique que devis/situations). Les dates de chaque etape sont
// conservees pour la tracabilite.
export const avenantStatutEnum = pgEnum("avenant_statut", ["BROUILLON", "SIGNE", "TRANSMIS", "IMPUTE"]);

export const avenantsMarcheTable = pgTable("avenants_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  // Pas de cascade : regle no-hard-delete, un marche n'est jamais supprime.
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  numero: integer("numero").notNull(),
  typeAvenant: avenantTypeEnum("type_avenant").notNull().default("AUTRE"),
  objet: text("objet").notNull(),
  montantHt: numeric("montant_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  indiceBase: numeric("indice_base", { precision: 10, scale: 4 }),
  indiceActuel: numeric("indice_actuel", { precision: 10, scale: 4 }),
  coefficientRevision: numeric("coefficient_revision", { precision: 10, scale: 6 }),
  dateSignature: timestamp("date_signature", { withTimezone: true }),
  statut: avenantStatutEnum("statut").notNull().default("BROUILLON"),
  modeTransmission: text("mode_transmission"),
  dateTransmission: timestamp("date_transmission", { withTimezone: true }),
  dateImputation: timestamp("date_imputation", { withTimezone: true }),
  justification: text("justification"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
