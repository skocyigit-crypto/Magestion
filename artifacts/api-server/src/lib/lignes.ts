import { z } from "zod";

// Lignes de devis/facture (designation/quantite/unite/prix/remise) — toutes
// les lignes d'un meme document partagent le taux de TVA du document parent
// (simplification deliberee, voir lib/db/src/schema/lignes.ts).
export const ligneInputSchema = z.object({
  designation: z.string().min(1).max(300),
  quantite: z.number().positive().max(99999.99),
  unite: z.string().min(1).max(20).optional(),
  prixUnitaireHt: z.number().nonnegative().max(9999999.99),
  remisePercent: z.number().min(0).max(100).optional(),
});
export type LigneInput = z.infer<typeof ligneInputSchema>;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ligneMontantHt(l: LigneInput): number {
  return round2(l.quantite * l.prixUnitaireHt * (1 - (l.remisePercent ?? 0) / 100));
}

export function totalLignesHt(lignes: LigneInput[]): number {
  return round2(lignes.reduce((s, l) => s + ligneMontantHt(l), 0));
}
