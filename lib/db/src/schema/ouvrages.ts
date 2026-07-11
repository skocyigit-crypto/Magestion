import { pgTable, uuid, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { articlesTable } from "./articles.js";

// debourseSecHt et prixVenteHt sont TOUJOURS calcules server-side depuis la
// composition (jamais acceptes bruts du client) — bug corrige des le depart :
// dans le projet de reference, l'ecran de creation laissait debourseSec=0
// (jamais recalcule), donnant une marge affichee de 100% factice.
export const ouvragesTable = pgTable("ouvrages", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  code: text("code").notNull(),
  libelle: text("libelle").notNull(),
  unite: text("unite").notNull().default("u"),
  coefficientK: numeric("coefficient_k", { precision: 4, scale: 2 }).notNull().default("1.30"),
  debourseSecHt: numeric("debourse_sec_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  prixVenteHt: numeric("prix_vente_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  tauxTva: numeric("taux_tva", { precision: 4, scale: 2 }).notNull().default("20"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Composition (sous-detail) d'un ouvrage : N articles + quantite chacun.
export const ouvrageArticlesTable = pgTable("ouvrage_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  ouvrageId: uuid("ouvrage_id")
    .notNull()
    .references(() => ouvragesTable.id),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articlesTable.id),
  quantite: numeric("quantite", { precision: 10, scale: 3 }).notNull(),
  ordre: integer("ordre").notNull().default(0),
});
