// Heuristique simple (budget + urgence + distance) — cf. doc produit
// "Lead Scoring : notation automatique (distance, budget, categorie)".
// Base 50, ajustements bornes [0, 100].
export function computeLeadScore(input: {
  budgetEstime: number;
  urgence: "BASSE" | "NORMALE" | "URGENTE" | "TRES_URGENTE";
  distanceKm?: number | null;
}): number {
  let score = 50;

  if (input.budgetEstime >= 20000) score += 20;
  else if (input.budgetEstime >= 5000) score += 10;

  if (input.urgence === "TRES_URGENTE") score += 20;
  else if (input.urgence === "URGENTE") score += 10;
  else if (input.urgence === "BASSE") score -= 10;

  if (input.distanceKm != null) {
    if (input.distanceKm <= 20) score += 10;
    else if (input.distanceKm > 50) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}
