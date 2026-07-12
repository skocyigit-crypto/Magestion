import { pgTable, uuid, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { sousTraitantsTable } from "./sousTraitants.js";

// Rattachement d'un sous-traitant a un chantier (M:N) — necessaire pour
// calculer le compte prorata (charges communes de chantier : eau, electricite,
// gardiennage... reparties entre tous les intervenants). Repartition par
// defaut = parts egales entre sous-traitants rattaches actifs.
export const chantierSousTraitantsTable = pgTable("chantier_sous_traitants", {
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
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prorataChargesTable = pgTable("prorata_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  libelle: text("libelle").notNull(),
  montantHt: numeric("montant_ht", { precision: 10, scale: 2 }).notNull(),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  dateOperation: date("date_operation").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
