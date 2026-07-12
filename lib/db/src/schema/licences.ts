import { pgTable, uuid, text, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const licencePlanEnum = pgEnum("licence_plan", ["TRIAL", "STARTER", "PME", "ENTREPRISE"]);
export const licenceStatusEnum = pgEnum("licence_status", ["ACTIF", "SUSPENDU", "ARCHIVE"]);

export const licencesTable = pgTable("licences", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  siret: varchar("siret", { length: 14 }),
  adresse: text("adresse"),
  codePostal: varchar("code_postal", { length: 10 }),
  ville: text("ville"),
  email: text("email"),
  telephone: varchar("telephone", { length: 30 }),
  tvaIntracommunautaire: varchar("tva_intracommunautaire", { length: 20 }),
  logoChemin: text("logo_chemin"),
  // Identifiant de la "Legal Entity" chez le fournisseur PDP (ex: Storecove) —
  // une licence = une entite legale distincte cote PDP (compte PDP unique pour
  // toutes les licences).
  pdpLegalEntityId: text("pdp_legal_entity_id"),
  plan: licencePlanEnum("plan").notNull().default("TRIAL"),
  status: licenceStatusEnum("status").notNull().default("ACTIF"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
