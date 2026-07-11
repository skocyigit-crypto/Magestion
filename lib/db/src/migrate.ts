import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Runner de migrations trace (portable, sans bash) : fichiers `NNNN_description.sql`
// dans ./migrations, tries numeriquement, appliques une seule fois (table
// schema_migrations), chacun dans sa propre transaction. Additif/idempotent
// uniquement — jamais de DELETE/DROP de donnees (regle absolue du projet).
// Meme logique sur pg (DATABASE_URL defini) ou PGlite (dev local sans cloud).

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");
// Chemin absolu : doit matcher exactement celui de src/index.ts, sinon
// migrate.ts et api-server pointeraient chacun vers une base PGlite differente.
const PGLITE_DATA_DIR = join(__dirname, "..", ".pglite-data");

if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_MIGRATIONS) {
  throw new Error(
    "Migrations refusees en production sans ALLOW_PROD_MIGRATIONS=1 explicite (garde-fou).",
  );
}

interface Adapter {
  execRaw(sql: string): Promise<void>;
  queryRows(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

function pgliteAdapter(): { adapter: Adapter; client: PGlite } {
  const client = new PGlite(PGLITE_DATA_DIR, { extensions: { pgcrypto } });
  return {
    client,
    adapter: {
      async execRaw(sql) {
        await client.exec(sql);
      },
      async queryRows(sql, params) {
        const { rows } = await client.query(sql, params);
        return rows as Record<string, unknown>[];
      },
      async close() {
        await client.close();
      },
    },
  };
}

async function main() {
  let adapter: Adapter;

  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    adapter = {
      execRaw: (sql) => client.query(sql).then(() => undefined),
      queryRows: (sql, params) => client.query(sql, params).then((r) => r.rows),
      close: () => client.end(),
    };
    console.log("[migrate] cible: Postgres (DATABASE_URL)");
  } else {
    console.log(`[migrate] cible: PGlite local (${PGLITE_DATA_DIR}) — DATABASE_URL absent`);
    adapter = pgliteAdapter().adapter;
  }

  await adapter.execRaw(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => {
      const na = parseInt(a.split("_")[0], 10);
      const nb = parseInt(b.split("_")[0], 10);
      return na - nb;
    });

  const appliedRows = await adapter.queryRows("SELECT filename FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.filename as string));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await adapter.execRaw(sql);
      await adapter.queryRows("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      console.log(`[migrate] applique: ${file}`);
      count++;
    } catch (err) {
      console.error(`[migrate] echec sur ${file}:`, err);
      await adapter.close();
      process.exit(1);
    }
  }

  console.log(`[migrate] termine — ${count} applique(s), ${files.length - count} deja a jour`);
  await adapter.close();
}

main();
