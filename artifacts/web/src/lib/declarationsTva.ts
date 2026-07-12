import { apiFetch } from "@/lib/api";

export type DeclarationTvaStatut = "BROUILLON" | "VALIDEE";

export interface DeclarationTva {
  id: string;
  periodeDebut: string;
  periodeFin: string;
  tvaCollectee: string;
  tvaDeductible: string;
  tvaAPayer: string;
  statut: DeclarationTvaStatut;
  dateValidation: string | null;
  active: boolean;
}

export interface TvaCalcul {
  tvaCollectee: number;
  tvaDeductible: number;
  tvaAPayer: number;
}

export function calculerTva(periodeDebut: string, periodeFin: string) {
  return apiFetch<TvaCalcul>("/declarations-tva/calculer", { method: "POST", body: JSON.stringify({ periodeDebut, periodeFin }) });
}

export function listDeclarationsTva() {
  return apiFetch<DeclarationTva[]>("/declarations-tva");
}

export function creerDeclarationTva(periodeDebut: string, periodeFin: string) {
  return apiFetch<DeclarationTva>("/declarations-tva", { method: "POST", body: JSON.stringify({ periodeDebut, periodeFin }) });
}

export function validerDeclarationTva(id: string) {
  return apiFetch<DeclarationTva>(`/declarations-tva/${id}/valider`, { method: "POST" });
}
