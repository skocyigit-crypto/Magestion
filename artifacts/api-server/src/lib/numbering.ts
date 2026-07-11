import { sql } from "drizzle-orm";
import { db } from "@magestion/db";

// Numero sequentiel par licence + annee : "PREFIX-2026-001". Compte les
// lignes existantes de l'annee en cours pour cette licence (simple, pas de
// compteur dedie — suffisant pour le volume attendu en phase 1).
// tableName est TOUJOURS une constante interne ("devis"/"factures"), jamais
// une valeur utilisateur — sql.raw() sur un identifiant fixe est sans risque.
export async function nextNumero(tableName: "devis" | "factures", prefix: string, licenceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COUNT(*)::text as count FROM ${sql.raw(tableName)} WHERE licence_id = ${licenceId} AND EXTRACT(YEAR FROM created_at) = ${year}`,
  );
  // Forme du resultat variable selon le driver (pg vs pglite) — .rows dans les deux cas.
  const rows = (result as unknown as { rows: { count: string }[] }).rows;
  const count = Number(rows[0]?.count ?? 0);
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}
