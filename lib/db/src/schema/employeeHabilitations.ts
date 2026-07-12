import { pgTable, uuid, text, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";
import { employeesTable } from "./employees.js";

// Documents/certifications RH a echeance (obligation legale BTP) — un
// employe peut en avoir plusieurs simultanement (ex: CACES R482 cat A + R486
// cat B). Le "besoin de renouvellement" (echeance sous 30 jours / deja
// expiree) est calcule a la volee depuis dateValidite, comme les relances.
export const habilitationTypeEnum = pgEnum("habilitation_type", [
  "CARTE_BTP", "VISITE_MEDICALE", "CACES", "TITRE_SEJOUR", "HABILITATION_ELECTRIQUE", "AUTRE",
]);

export const employeeHabilitationsTable = pgTable("employee_habilitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  type: habilitationTypeEnum("type").notNull(),
  libelle: text("libelle"),
  dateValidite: date("date_validite").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
