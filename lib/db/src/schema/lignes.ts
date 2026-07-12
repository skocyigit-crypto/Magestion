import { pgTable, uuid, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { devisTable } from "./devis.js";
import { facturesTable } from "./factures.js";

// Lignes de devis/facture (designation/quantite/unite/prix/remise). Toutes
// les lignes d'un meme document partagent le taux de TVA du document
// (devis.tauxTva / factures.tauxTva) — simplification deliberee : un devis
// BTP mono-corps-de-metier n'a quasiment jamais de taux TVA mixte au sein
// d'un meme document, et ca evite une ventilation TVA multi-taux dans le
// PDF/Factur-X/comptabilite. montantHt du document parent = somme des lignes,
// recalcule a chaque sauvegarde des lignes (voir routes/devis.ts, factures.ts).
export const devisLignesTable = pgTable("devis_lignes", {
  id: uuid("id").primaryKey().defaultRandom(),
  devisId: uuid("devis_id")
    .notNull()
    .references(() => devisTable.id),
  ordre: integer("ordre").notNull().default(0),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
  unite: text("unite").notNull().default("u"),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  remisePercent: numeric("remise_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const factureLignesTable = pgTable("facture_lignes", {
  id: uuid("id").primaryKey().defaultRandom(),
  factureId: uuid("facture_id")
    .notNull()
    .references(() => facturesTable.id),
  ordre: integer("ordre").notNull().default(0),
  designation: text("designation").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 2 }).notNull().default("1"),
  unite: text("unite").notNull().default("u"),
  prixUnitaireHt: numeric("prix_unitaire_ht", { precision: 12, scale: 2 }).notNull().default("0"),
  remisePercent: numeric("remise_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
