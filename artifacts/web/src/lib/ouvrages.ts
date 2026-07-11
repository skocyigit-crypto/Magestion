import { apiFetch } from "@/lib/api";

export interface Ouvrage {
  id: string;
  code: string;
  libelle: string;
  unite: string;
  coefficientK: string;
  debourseSecHt: string;
  prixVenteHt: string;
  tauxTva: string;
  active: boolean;
}

export interface CompositionLine {
  articleId: string;
  quantite: number;
}

export interface OuvrageInput {
  code: string;
  libelle: string;
  unite?: string;
  coefficientK?: number;
  tauxTva?: 0 | 5.5 | 10 | 20;
  composition: CompositionLine[];
}

export interface CompositionDetail {
  id: string;
  articleId: string;
  quantite: string;
  code: string;
  libelle: string;
  unite: string;
  prixUnitaireHt: string;
}

export function listOuvrages() {
  return apiFetch<Ouvrage[]>("/ouvrages");
}

export function createOuvrage(input: OuvrageInput) {
  return apiFetch<Ouvrage>("/ouvrages", { method: "POST", body: JSON.stringify(input) });
}

export function getComposition(ouvrageId: string) {
  return apiFetch<CompositionDetail[]>(`/ouvrages/${ouvrageId}/composition`);
}
