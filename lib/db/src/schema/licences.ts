import { pgTable, uuid, text, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const licencePlanEnum = pgEnum("licence_plan", ["TRIAL", "STARTER", "PME", "ENTREPRISE"]);
export const licenceStatusEnum = pgEnum("licence_status", ["ACTIF", "SUSPENDU", "ARCHIVE"]);

export const licencesTable = pgTable("licences", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  siret: varchar("siret", { length: 14 }),
  plan: licencePlanEnum("plan").notNull().default("TRIAL"),
  status: licenceStatusEnum("status").notNull().default("ACTIF"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
