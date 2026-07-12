import { pgTable, uuid, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { projectsTable } from "./projects.js";

// La retenue de garantie elle-meme est deja calculee par situation
// (situations.tauxRetenueGarantie + lib/situationCalc.ts) — cette table ne
// suit que sa LIBERATION (le client rembourse la retenue apres la periode de
// garantie de parfait achevement, generalement 1 an apres reception). Le
// "reste a liberer" par chantier = somme des retenues des situations VALIDEE
// moins la somme des liberations enregistrees ici (voir routes/retenuesGarantie.ts).
export const retenueLiberationsTable = pgTable("retenue_liberations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
  dateLiberation: date("date_liberation").notNull(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
