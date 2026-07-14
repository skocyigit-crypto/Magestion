import { apiFetch } from "@/lib/api";

export interface TarifFournisseur {
  id: string;
  fournisseurId: string;
  articleId: string;
  prixUnitaireHt: string;
  referenceFournisseur: string | null;
  delaiLivraisonJours: number | null;
  dateValidite: string | null;
  active: boolean;
}

export interface TarifFournisseurInput {
  fournisseurId: string;
  articleId: string;
  prixUnitaireHt: number;
  referenceFournisseur?: string;
  delaiLivraisonJours?: number;
  dateValidite?: string;
}

export function listTarifsFournisseurs(params: { articleId?: string; fournisseurId?: string }) {
  const query = new URLSearchParams();
  if (params.articleId) query.set("articleId", params.articleId);
  if (params.fournisseurId) query.set("fournisseurId", params.fournisseurId);
  const qs = query.toString();
  return apiFetch<TarifFournisseur[]>(`/tarifs-fournisseurs${qs ? `?${qs}` : ""}`);
}

export function upsertTarifFournisseur(input: TarifFournisseurInput) {
  return apiFetch<TarifFournisseur>("/tarifs-fournisseurs", { method: "POST", body: JSON.stringify(input) });
}

export function updateTarifFournisseur(id: string, input: Partial<Omit<TarifFournisseurInput, "fournisseurId" | "articleId">> & { active?: boolean }) {
  return apiFetch<TarifFournisseur>(`/tarifs-fournisseurs/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
