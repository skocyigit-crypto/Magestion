import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

// role=SUPER_ADMIN + licenceId=null => platform owner (cross-tenant, gated separately)
export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "COMMERCIAL", "TERRAIN", "COMPTABILITE"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id").references(() => licencesTable.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nom: text("nom").notNull(),
  role: userRoleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
