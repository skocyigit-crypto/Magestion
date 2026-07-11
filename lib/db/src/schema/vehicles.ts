import { pgTable, uuid, text, varchar, integer, date, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "CAMION", "CAMIONNETTE", "FOURGON", "VOITURE", "ENGIN_CHANTIER", "AUTRE",
]);
export const vehicleCarburantEnum = pgEnum("vehicle_carburant", ["DIESEL", "ESSENCE", "ELECTRIQUE", "GPL", "HYBRIDE"]);
export const vehicleStatutEnum = pgEnum("vehicle_statut", ["DISPONIBLE", "EN_MISSION", "EN_MAINTENANCE", "HORS_SERVICE"]);

export const vehiclesTable = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  immatriculation: varchar("immatriculation", { length: 20 }).notNull(),
  marque: text("marque"),
  modele: text("modele"),
  type: vehicleTypeEnum("type").notNull().default("AUTRE"),
  carburant: vehicleCarburantEnum("carburant").notNull().default("DIESEL"),
  statut: vehicleStatutEnum("statut").notNull().default("DISPONIBLE"),
  kilometrage: integer("kilometrage").notNull().default(0),
  dateAssuranceValidite: date("date_assurance_validite"),
  dateControleTechniqueValidite: date("date_controle_technique_validite"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
