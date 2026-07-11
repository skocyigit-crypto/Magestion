import { pgTable, uuid, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const articleCategorieEnum = pgEnum("article_categorie", [
  "FOURNITURE",
  "MAIN_OEUVRE",
  "MATERIEL",
  "SOUS_TRAITANCE",
  "DIVERS",
]);

export const articlesTable = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  code: text("code").notNull(),
  libelle: text("libelle").notNull(),
  unite: text("unite").notNull().default("u"),
  categorie: articleCategorieEnum("categorie").notNull().default("DIVERS"),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
