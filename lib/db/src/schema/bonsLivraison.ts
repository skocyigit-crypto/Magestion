import { pgTable, uuid, integer, numeric, text, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { commandesTable } from "./commandes.js";

// BROUILLON = modifiable ; VALIDE = verrouille (meme regle que situations/factures).
export const bonLivraisonStatutEnum = pgEnum("bon_livraison_statut", ["BROUILLON", "VALIDE"]);
export const bonLivraisonConformiteEnum = pgEnum("bon_livraison_conformite", ["CONFORME", "NON_CONFORME", "PARTIELLE"]);

// Une commande n'ayant pas de lignes detaillees (montant global unique, voir
// schema/commandes.ts), un bon de livraison enregistre un POURCENTAGE cumule
// livre plutot que des quantites par ligne — meme principe que les situations
// de travaux (avancementPercent cumulatif) applique aux commandes fournisseurs.
// commandeMontantHt est fige a la creation (independant d'une modification
// ulterieure de la commande), meme logique que situations.marcheHt.
export const bonsLivraisonTable = pgTable("bons_livraison", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  commandeId: uuid("commande_id")
    .notNull()
    .references(() => commandesTable.id),
  numeroBl: integer("numero_bl").notNull(),
  commandeMontantHt: numeric("commande_montant_ht", { precision: 12, scale: 2 }).notNull(),
  pourcentageLivre: numeric("pourcentage_livre", { precision: 5, scale: 2 }).notNull(),
  statut: bonLivraisonStatutEnum("statut").notNull().default("BROUILLON"),
  conformite: bonLivraisonConformiteEnum("conformite").notNull().default("CONFORME"),
  dateLivraison: date("date_livraison").notNull().defaultNow(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
