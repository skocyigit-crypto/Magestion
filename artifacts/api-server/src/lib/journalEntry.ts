import { and, desc, eq } from "drizzle-orm";
import { db, journalEntriesTable } from "@magestion/db";

interface EntryLine {
  compteNum: string;
  compteLib: string;
  debit?: number;
  credit?: number;
}

const EPSILON = 0.01;

// Insere une ecriture equilibree (plusieurs lignes, meme ecritureNum). Rejette
// (throw) toute ecriture qui ne s'equilibre pas — garde-fou anti-corruption
// comptable, aucune ecriture desequilibree ne doit jamais atteindre la table.
export async function recordJournalEntry(params: {
  licenceId: string;
  journalCode: "AC" | "VE" | "OD";
  pieceRef: string;
  ecritureLib: string;
  sourceType: "FACTURE" | "DEPENSE";
  sourceId: string;
  lines: EntryLine[];
}) {
  const totalDebit = params.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = params.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > EPSILON) {
    throw new Error(
      `Ecriture desequilibree (${params.pieceRef}) : debit=${totalDebit} credit=${totalCredit}`,
    );
  }

  const [last] = await db
    .select({ ecritureNum: journalEntriesTable.ecritureNum })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.licenceId, params.licenceId))
    .orderBy(desc(journalEntriesTable.ecritureNum))
    .limit(1);
  const ecritureNum = (last?.ecritureNum ?? 0) + 1;

  const rows = params.lines
    .filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0)
    .map((l) => ({
      licenceId: params.licenceId,
      journalCode: params.journalCode,
      ecritureNum,
      compteNum: l.compteNum,
      compteLib: l.compteLib,
      pieceRef: params.pieceRef,
      ecritureLib: params.ecritureLib,
      debit: (l.debit ?? 0).toFixed(2),
      credit: (l.credit ?? 0).toFixed(2),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    }));

  await db.insert(journalEntriesTable).values(rows);
}

// Genere l'ecriture de vente (VE) a l'emission d'une facture client :
//   Debit  411 Clients            = TTC
//   Credit 706 Travaux            = HT
//   Credit 44571 TVA collectee    = TVA (si > 0)
export async function recordFactureEmission(params: {
  licenceId: string;
  factureId: string;
  numero: string;
  client: string;
  montantHt: number;
  tauxTva: number;
}) {
  const montantTva = params.montantHt * (params.tauxTva / 100);
  const montantTtc = params.montantHt + montantTva;

  await recordJournalEntry({
    licenceId: params.licenceId,
    journalCode: "VE",
    pieceRef: params.numero,
    ecritureLib: `Facture ${params.numero} — ${params.client}`,
    sourceType: "FACTURE",
    sourceId: params.factureId,
    lines: [
      { compteNum: "411", compteLib: "Clients", debit: montantTtc },
      { compteNum: "706", compteLib: "Prestations de services / Travaux", credit: params.montantHt },
      ...(montantTva > 0 ? [{ compteNum: "44571", compteLib: "TVA collectee", credit: montantTva }] : []),
    ],
  });
}

// Genere l'ecriture d'achat (AC) a la creation d'une depense fournisseur.
//   Cas normal :
//     Debit  606/604 Achats       = HT
//     Debit  44566 TVA deductible = TVA
//     Credit 401 Fournisseurs     = TTC
//   Cas autoliquidation (sous-traitance BTP, art. 283-2 nonies CGI) : le
//   fournisseur facture HT, la TVA est autoliquidee (double mouvement N8,
//   aucun flux de tresorerie TVA avec le fournisseur) :
//     Debit  604 Achats           = HT
//     Debit  44566 TVA deductible = TVA
//     Credit 44571 TVA collectee  = TVA  (autoliquidee, pas payee au fournisseur)
//     Credit 401 Fournisseurs     = HT uniquement (pas de TVA versee)
export async function recordDepenseReception(params: {
  licenceId: string;
  depenseId: string;
  fournisseur: string;
  categorie: string;
  montantHt: number;
  tauxTva: number;
  autoliquidation: boolean;
}) {
  const montantTva = params.montantHt * (params.tauxTva / 100);
  const compteAchat = params.categorie === "SOUS_TRAITANCE" ? "604" : "606";
  const compteAchatLib =
    compteAchat === "604" ? "Achats d'etudes et prestations de services (sous-traitance)" : "Achats non stockes de matieres et fournitures";

  const lines: EntryLine[] = [{ compteNum: compteAchat, compteLib: compteAchatLib, debit: params.montantHt }];

  if (params.autoliquidation) {
    if (montantTva > 0) {
      lines.push({ compteNum: "44566", compteLib: "TVA deductible sur autres biens et services", debit: montantTva });
      lines.push({ compteNum: "44571", compteLib: "TVA collectee", credit: montantTva });
    }
    lines.push({ compteNum: "401", compteLib: "Fournisseurs", credit: params.montantHt });
  } else {
    if (montantTva > 0) {
      lines.push({ compteNum: "44566", compteLib: "TVA deductible sur autres biens et services", debit: montantTva });
    }
    lines.push({ compteNum: "401", compteLib: "Fournisseurs", credit: params.montantHt + montantTva });
  }

  await recordJournalEntry({
    licenceId: params.licenceId,
    journalCode: "AC",
    pieceRef: `DEP-${params.depenseId.slice(0, 8)}`,
    ecritureLib: `Depense ${params.fournisseur}${params.autoliquidation ? " (autoliquidation TVA)" : ""}`,
    sourceType: "DEPENSE",
    sourceId: params.depenseId,
    lines,
  });
}
