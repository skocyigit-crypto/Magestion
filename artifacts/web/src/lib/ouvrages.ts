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

export function listOuvrages(onlyInactive = false) {
  return apiFetch<Ouvrage[]>(`/ouvrages${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createOuvrage(input: OuvrageInput) {
  return apiFetch<Ouvrage>("/ouvrages", { method: "POST", body: JSON.stringify(input) });
}

export interface OuvrageUpdateInput extends Partial<OuvrageInput> {
  active?: boolean;
}

export function updateOuvrage(id: string, input: OuvrageUpdateInput) {
  return apiFetch<Ouvrage>(`/ouvrages/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getComposition(ouvrageId: string) {
  return apiFetch<CompositionDetail[]>(`/ouvrages/${ouvrageId}/composition`);
}
