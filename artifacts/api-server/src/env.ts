import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Doit etre importe en PREMIER (avant tout autre import, y compris ceux qui
// lisent process.env au chargement du module comme @magestion/db) : les
// imports ESM sont evalues en profondeur, dans l'ordre textuel, avant le
// corps du module courant — donc seul un import place avant les autres
// garantit que .env est charge a temps. .env vit a la racine du monorepo ;
// chemin absolu car pnpm --filter execute ce package avec cwd=artifacts/api-server.
config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env") });
