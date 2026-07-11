import { pgTable, uuid, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

export const mouvementTypeEnum = pgEnum("mouvement_type", ["ENTREE", "SORTIE"]);

export const stockItemsTable = pgTable("stock_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  categorie: text("categorie"),
  unite: text("unite").notNull().default("u"),
  quantiteActuelle: numeric("quantite_actuelle", { precision: 10, scale: 2 }).notNull().default("0"),
  seuilAlerte: numeric("seuil_alerte", { precision: 10, scale: 2 }).notNull().default("0"),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Chaque mouvement met a jour stockItems.quantiteActuelle de facon atomique
// (voir routes/stock.ts) — quantiteActuelle est une valeur derivee mais
// stockee pour eviter un SUM() a chaque lecture ; source de verite = mouvements.
export const stockMovementsTable = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  stockItemId: uuid("stock_item_id")
    .notNull()
    .references(() => stockItemsTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  type: mouvementTypeEnum("type").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull(),
  motif: text("motif"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
