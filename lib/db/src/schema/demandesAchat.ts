import { pgTable, uuid, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";
import { employeesTable } from "./employees.js";
import { commandesTable } from "./commandes.js";

// EN_ATTENTE -> APPROUVEE -> CONVERTIE (transformee en commande fournisseur),
// ou EN_ATTENTE -> REJETEE. Workflow d'autorisation d'achat avant engagement
// de depense — distinct des commandes (qui supposent une autorite d'achat deja
// acquise). Un chef de chantier (TERRAIN) demande, la comptabilite (COMPTABILITE)
// approuve/rejette/convertit (voir routes/demandesAchat.ts, meme repartition de
// roles que devis -> facture).
export const demandeAchatStatutEnum = pgEnum("demande_achat_statut", [
  "EN_ATTENTE",
  "APPROUVEE",
  "REJETEE",
  "CONVERTIE",
]);

export const demandesAchatTable = pgTable("demandes_achat", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  demandeurId: uuid("demandeur_id").references(() => employeesTable.id),
  objet: text("objet").notNull(),
  quantiteEstimee: text("quantite_estimee"),
  montantEstimeHt: numeric("montant_estime_ht", { precision: 12, scale: 2 }),
  statut: demandeAchatStatutEnum("statut").notNull().default("EN_ATTENTE"),
  motifRejet: text("motif_rejet"),
  // Rempli uniquement lors de la conversion (voir routes/demandesAchat.ts POST /:id/convertir-commande).
  commandeId: uuid("commande_id").references(() => commandesTable.id),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
