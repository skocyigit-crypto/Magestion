import { pgTable, uuid, text, integer, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { fournisseursTable } from "./fournisseurs.js";
import { articlesTable } from "./articles.js";

// Prix d'un article chez un fournisseur donne : permet de comparer plusieurs
// fournisseurs pour le meme article catalogue (voir routes/tarifsFournisseurs.ts
// GET /?articleId= trie par prix croissant). Un seul tarif actif par couple
// (fournisseur, article) — on met a jour le prix existant plutot que d'empiler
// un historique (pas de besoin identifie de conserver les anciens prix).
export const tarifsFournisseursTable = pgTable("tarifs_fournisseurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  fournisseurId: uuid("fournisseur_id")
    .notNull()
    .references(() => fournisseursTable.id),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articlesTable.id),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 10, scale: 2 }).notNull(),
  referenceFournisseur: text("reference_fournisseur"),
  delaiLivraisonJours: integer("delai_livraison_jours"),
  dateValidite: date("date_validite"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
