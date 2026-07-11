import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

// Chemin absolu (pas cwd-relatif — meme raison que PGLITE_DATA_DIR dans
// @magestion/db) : racine du package api-server, pas la racine du monorepo.
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR
  ? join(PACKAGE_ROOT, process.env.LOCAL_STORAGE_DIR)
  : join(PACKAGE_ROOT, "storage");

mkdirSync(STORAGE_DIR, { recursive: true });
