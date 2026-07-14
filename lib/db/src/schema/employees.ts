import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { licencesTable } from "./licences.js";

export const employeeRoleEnum = pgEnum("employee_role", [
  "CHEF_CHANTIER",
  "CONDUCTEUR_TRAVAUX",
  "MACON",
  "ELECTRICIEN",
  "PLOMBIER",
  "CHARPENTIER",
  "COUVREUR",
  "PEINTRE",
  "CARRELEUR",
  "MANOEUVRE",
  "AUTRE",
]);

export const employeeStatutEnum = pgEnum("employee_statut", ["SUR_CHANTIER", "EN_ROUTE", "ABSENT", "INDISPONIBLE", "CONGE"]);

// Palette de couleurs distinctes par employe (gap identifie : Bridgit/Float/
// Procore codent chaque employe par couleur en planning, la reference ne le
// faisait pas). Couleur assignee en rotation a la creation (voir routes/employees.ts).
export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenceId: uuid("licence_id")
    .notNull()
    .references(() => licencesTable.id),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  role: employeeRoleEnum("role").notNull().default("AUTRE"),
  telephone: varchar("telephone", { length: 30 }),
  email: text("email"),
  tauxHoraire: numeric("taux_horaire", { precision: 8, scale: 2 }).notNull().default("0"),
  couleur: varchar("couleur", { length: 7 }).notNull().default("#F59E0B"),
  statut: employeeStatutEnum("statut").notNull().default("ABSENT"),
  // Irreversible (droit a l'effacement RGPD) — voir routes/rgpd.ts.
  anonymise: boolean("anonymise").notNull().default(false),
  // Donnee biometrique (voir routes/faceRecognition.ts) : consentement explicite
  // requis AVANT tout upload de photoUrl (verifie server-side, jamais de
  // defaut a true) — retrait revocable a tout moment via PATCH /employees/:id,
  // distinct de anonymise (RGPD generique) car regi par une base legale propre.
  consentementReconnaissanceFaciale: boolean("consentement_reconnaissance_faciale").notNull().default(false),
  photoUrl: text("photo_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
