import { sql } from "drizzle-orm";
import { db } from "@magestion/db";

// Numero sequentiel par licence + annee : "PREFIX-2026-001". Compte les
// lignes existantes de l'annee en cours pour cette licence (simple, pas de
// compteur dedie — suffisant pour le volume attendu en phase 1).
// tableName est TOUJOURS une constante interne ("devis"/"factures"), jamais
// une valeur utilisateur — sql.raw() sur un identifiant fixe est sans risque.
export async function nextNumero(tableName: "devis" | "factures" | "avoirs" | "marches_publics", prefix: string, licenceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COUNT(*)::text as count FROM ${sql.raw(tableName)} WHERE licence_id = ${licenceId} AND EXTRACT(YEAR FROM created_at) = ${year}`,
  );
  // Forme du resultat variable selon le driver (pg vs pglite) — .rows dans les deux cas.
  const rows = (result as unknown as { rows: { count: string }[] }).rows;
  const count = Number(rows[0]?.count ?? 0);
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}

// nextNumero() n'est pas verrouille : deux requetes concurrentes peuvent lire
// le meme COUNT et calculer le meme numero. Plutot qu'un verrou (complexite
// transactionnelle cross-driver pg/pglite), on s'appuie sur l'index unique
// (licence_id, numero) en base (migration 0016) : en cas de collision reelle,
// l'insert leve une violation 23505 qu'on rattrape ici en retentant avec un
// numero frais — la course devient invisible pour l'utilisateur au lieu de
// produire silencieusement un doublon (obligation legale de continuite de
// numerotation des devis/factures).
export async function withNumero<T>(
  tableName: "devis" | "factures" | "avoirs" | "marches_publics",
  prefix: string,
  licenceId: string,
  insert: (numero: string) => Promise<T>,
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const numero = await nextNumero(tableName, prefix, licenceId);
    try {
      return await insert(numero);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "23505" || attempt === MAX_ATTEMPTS) throw err;
    }
  }
  throw new Error("Impossible de generer un numero unique apres plusieurs tentatives");
}
