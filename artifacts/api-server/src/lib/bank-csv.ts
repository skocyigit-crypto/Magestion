// Import de releve bancaire au format CSV (pas d'agregateur bancaire tiers
// configure — voir lib/pdp.ts pour le meme principe simulation/reel applique
// a la facturation electronique). Format attendu, une ligne par operation :
// date;libelle;montant[;reference] — avec ; ou , comme separateur, date en
// JJ/MM/AAAA ou AAAA-MM-JJ, montant avec , ou . comme separateur decimal.
// Le montant est signe : positif = encaissement, negatif = paiement.

export interface ParsedTransaction {
  dateOperation: string; // YYYY-MM-DD
  libelle: string;
  montant: number;
  reference?: string;
}

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseMontant(raw: string): number | null {
  const cleaned = raw.trim().replace(/[€\s]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse un CSV de releve bancaire. Ignore silencieusement les lignes illisibles (fichier reel jamais parfait). */
export function parseBankCsv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const results: ParsedTransaction[] = [];

  for (const line of lines) {
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;

    const dateOperation = parseDate(cols[0]);
    const montant = parseMontant(cols[2]);
    if (!dateOperation || montant === null || !cols[1]) continue; // ligne d'en-tete ou illisible, ignoree

    results.push({ dateOperation, libelle: cols[1], montant, reference: cols[3] || undefined });
  }

  return results;
}
