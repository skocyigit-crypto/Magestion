import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { usersTable } from "./users.js";

export const rgpdActionEnum = pgEnum("rgpd_action", ["EXPORT", "ANONYMISATION", "CONSENTEMENT"]);
export const rgpdEntityTypeEnum = pgEnum("rgpd_entity_type", ["EMPLOYEE", "PROSPECT"]);

// Journal d'acces aux donnees personnelles (obligation de tracabilite RGPD,
// art. 30) — jamais purge, jamais modifiable apres creation (aucune route
// PATCH/DELETE n'existe pour cette table).
export const journalRgpdTable = pgTable("journal_rgpd", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  action: rgpdActionEnum("action").notNull(),
  entityType: rgpdEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  effectuePar: uuid("effectue_par").references(() => usersTable.id),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
