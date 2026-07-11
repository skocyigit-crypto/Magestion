import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Pool } from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";

// Portabilite dev : sans DATABASE_URL (pas de cloud Postgres configure), on
// bascule sur PGlite (Postgres embarque, fichier local ./.pglite-data) — zero
// installation. Avec DATABASE_URL (Neon/Supabase/autre), on utilise le vrai
// Postgres via `pg`. Meme schema/migrations dans les deux cas.
// Chemin absolu (pas cwd-relatif) : sinon api-server et migrate.ts, lances
// depuis des dossiers differents, creeraient chacun leur propre base PGlite.
const PGLITE_DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".pglite-data");

type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let db: Db;
let closeDb: () => Promise<void>;

if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNodePg(pool, { schema });
  closeDb = () => pool.end();
} else {
  console.warn(
    `[db] DATABASE_URL absent — mode dev local PGlite (${PGLITE_DATA_DIR}). ` +
      "Definissez DATABASE_URL (Neon, Supabase...) pour un Postgres partage/persistant.",
  );
  const client = new PGlite(PGLITE_DATA_DIR, { extensions: { pgcrypto } });
  db = drizzlePglite(client, { schema });
  // Fermeture propre INDISPENSABLE avec PGlite : un kill brutal (SIGKILL /
  // taskkill /F) laisse un postmaster.pid orphelin -> RuntimeError WASM au
  // prochain demarrage, force a effacer .pglite-data. D'ou le handler
  // SIGINT/SIGTERM cote api-server qui appelle closeDb() avant de quitter.
  closeDb = () => client.close();
}

export { db, closeDb };
export * from "./schema/index.js";
