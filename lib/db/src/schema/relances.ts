import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { devisTable } from "./devis.js";

export const relanceTypeEnum = pgEnum("relance_type", ["EMAIL", "APPEL", "SMS", "AUTRE"]);

// Journal des relances effectuees (pas de suppression — historique). Le
// "besoin de relance" (J+7/J+14/J+30) est calcule a la volee depuis
// devis.dateEnvoi, pas stocke ici (voir routes/relances.ts).
export const relancesTable = pgTable("relances", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  devisId: uuid("devis_id")
    .notNull()
    .references(() => devisTable.id),
  type: relanceTypeEnum("type").notNull().default("EMAIL"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
