import { pgTable, uuid, text, numeric, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { marchesPublicsTable } from "./marchesPublics.js";
import { lotsMarcheTable } from "./lotsMarche.js";
import { sousTraitantsTable } from "./sousTraitants.js";

// --- Ordres de service (CCAG-T) : instruction ecrite, numerotee, datee. ---
export const osStatutEnum = pgEnum("os_statut", ["NOTIFIE", "EXECUTE", "REFUSE", "RESERVES"]);

export const ordresServiceTable = pgTable("os_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  lotId: uuid("lot_id").references(() => lotsMarcheTable.id),
  numero: integer("numero").notNull(),
  dateOs: timestamp("date_os", { withTimezone: true }).notNull(),
  objet: text("objet").notNull(),
  prescription: text("prescription").notNull(),
  delaiExecution: text("delai_execution"),
  incidenceFinanciereHt: numeric("incidence_financiere_ht", { precision: 14, scale: 2 }),
  statut: osStatutEnum("statut").notNull().default("NOTIFIE"),
  reserves: text("reserves"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Proces-verbaux de reception (CCAG-T art. 41-44). ---
export const typePvEnum = pgEnum("type_pv", [
  "OPR",
  "RECEPTION",
  "RECEPTION_AVEC_RESERVES",
  "LEVEE_RESERVES",
  "REFUS_RECEPTION",
]);

export const pvReceptionTable = pgTable("pv_reception", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  lotId: uuid("lot_id").references(() => lotsMarcheTable.id),
  typePv: typePvEnum("type_pv").notNull(),
  numero: integer("numero").notNull().default(1),
  datePv: timestamp("date_pv", { withTimezone: true }).notNull(),
  dateEffetReception: timestamp("date_effet_reception", { withTimezone: true }),
  // Reserves libres : [{ description, localisation?, leveeAt? }]. Pas de type
  // dedie cote DB (jsonb libre), coherent avec le reste de Magestion (voir
  // situations.ts / documents.ts pour la meme approche sur des champs annexes).
  reserves: text("reserves"),
  observations: text("observations"),
  // Declenche le depart des garanties GPA/biennale/decennale (voir routes/executionMarche.ts).
  declencheGaranties: boolean("declenche_garanties").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Decompte General Definitif : cloture financiere (CCAG-T art. 12). ---
export const dgdStatutEnum = pgEnum("dgd_statut", [
  "BROUILLON",
  "ETABLI",
  "NOTIFIE",
  "ACCEPTE",
  "CONTESTE",
  "DEFINITIF",
]);

export const dgdMarcheTable = pgTable("dgd_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  lotId: uuid("lot_id").references(() => lotsMarcheTable.id),
  numero: integer("numero").notNull().default(1),
  dateEtablissement: timestamp("date_etablissement", { withTimezone: true }).notNull(),
  dateNotification: timestamp("date_notification", { withTimezone: true }),
  dateAcceptation: timestamp("date_acceptation", { withTimezone: true }),
  montantInitialHt: numeric("montant_initial_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  montantAvenantsHt: numeric("montant_avenants_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  montantRevisionHt: numeric("montant_revision_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  penalitesHt: numeric("penalites_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  primesHt: numeric("primes_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  retenueGarantieHt: numeric("retenue_garantie_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDgdHt: numeric("total_dgd_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 5, scale: 2 }).notNull().default("20"),
  totalDgdTtc: numeric("total_dgd_ttc", { precision: 14, scale: 2 }).notNull().default("0"),
  acomptesPercus: numeric("acomptes_percus", { precision: 14, scale: 2 }).notNull().default("0"),
  soldeARegler: numeric("solde_a_regler", { precision: 14, scale: 2 }).notNull().default("0"),
  reservesAcceptation: text("reserves_acceptation"),
  statut: dgdStatutEnum("statut").notNull().default("BROUILLON"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Garanties : GPA (1 an), biennale (2 ans), decennale (10 ans), cautions. ---
export const typeGarantieEnum = pgEnum("type_garantie", [
  "GPA",
  "BIENNALE",
  "DECENNALE",
  "CAUTION_DEFINITIVE",
  "RETENUE_GARANTIE",
  "CAUTION_AVANCE",
]);
export const garantieStatutEnum = pgEnum("garantie_statut", ["ACTIVE", "LEVEE", "EXPIREE", "MISE_EN_JEU"]);

export const garantiesMarcheTable = pgTable("garanties_marche", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  lotId: uuid("lot_id").references(() => lotsMarcheTable.id),
  typeGarantie: typeGarantieEnum("type_garantie").notNull(),
  emetteur: text("emetteur"),
  numeroActe: text("numero_acte"),
  montantHt: numeric("montant_ht", { precision: 14, scale: 2 }),
  pourcentage: numeric("pourcentage", { precision: 5, scale: 2 }),
  dateDebut: timestamp("date_debut", { withTimezone: true }),
  dateFin: timestamp("date_fin", { withTimezone: true }),
  dateLevee: timestamp("date_levee", { withTimezone: true }),
  statut: garantieStatutEnum("statut").notNull().default("ACTIVE"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Sous-traitance sur marche : DC4 + agrement MOA + paiement direct si > 600 EUR ---
// (loi du 31/12/1975). Reutilise le registre sous_traitants existant (raison
// sociale/siret/assurances deja geres la-bas) plutot que de dupliquer ces
// champs : seule l'affectation au marche + le workflow DC4 sont propres a
// cette table.
export const sousTraitantMarcheStatutEnum = pgEnum("sous_traitant_marche_statut", [
  "PROPOSE",
  "ACCEPTE_MOA",
  "REFUSE",
  "ACTIF",
  "TERMINE",
]);

export const marcheSousTraitantsTable = pgTable("marche_sous_traitants", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  marcheId: uuid("marche_id")
    .notNull()
    .references(() => marchesPublicsTable.id),
  lotId: uuid("lot_id").references(() => lotsMarcheTable.id),
  sousTraitantId: uuid("sous_traitant_id")
    .notNull()
    .references(() => sousTraitantsTable.id),
  natureTravaux: text("nature_travaux").notNull(),
  montantSousTraiteHt: numeric("montant_sous_traite_ht", { precision: 14, scale: 2 }).notNull().default("0"),
  // > 600 EUR : paiement direct obligatoire (loi 31/12/1975).
  paiementDirect: boolean("paiement_direct").notNull().default(true),
  dateDc4: timestamp("date_dc4", { withTimezone: true }),
  dateAgrement: timestamp("date_agrement", { withTimezone: true }),
  dateNotification: timestamp("date_notification", { withTimezone: true }),
  statut: sousTraitantMarcheStatutEnum("statut").notNull().default("PROPOSE"),
  motifRefus: text("motif_refus"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
