import { pgTable, text, boolean } from "drizzle-orm/pg-core";

// Plan comptable partage (referentiel global, pas de licenceId) — comptes BTP
// standards seedes en migration (0009). Pas de CRUD ici : lecture seule pour
// l'instant, extension future si besoin de comptes personnalises par tenant.
export const planComptableTable = pgTable("plan_comptable", {
  compteNum: text("compte_num").primaryKey(),
  libelle: text("libelle").notNull(),
  active: boolean("active").notNull().default(true),
});
