import { apiFetch, downloadFile } from "@/lib/api";
import type { Ligne, LigneInput } from "@/lib/devis";

export type AvoirStatut = "BROUILLON" | "EMIS";

export interface Avoir {
  id: string;
  factureId: string;
  numero: string;
  motif: string;
  montantHt: string;
  tauxTva: string;
  statut: AvoirStatut;
  dateEmission: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvoirInput {
  factureId: string;
  motif: string;
  lignes: LigneInput[];
}

export function listAvoirs() {
  return apiFetch<Avoir[]>("/avoirs");
}

export function createAvoir(input: AvoirInput) {
  return apiFetch<Avoir>("/avoirs", { method: "POST", body: JSON.stringify(input) });
}

export function getAvoir(id: string) {
  return apiFetch<Avoir>(`/avoirs/${id}`);
}

export function listAvoirLignes(id: string) {
  return apiFetch<Ligne[]>(`/avoirs/${id}/lignes`);
}

export function saveAvoirLignes(id: string, lignes: LigneInput[]) {
  return apiFetch<{ avoir: Avoir; lignes: Ligne[] }>(`/avoirs/${id}/lignes`, { method: "PUT", body: JSON.stringify({ lignes }) });
}

export function emettreAvoir(id: string) {
  return apiFetch<Avoir>(`/avoirs/${id}/emettre`, { method: "POST" });
}

export function downloadAvoirPdf(id: string, numero: string) {
  return downloadFile(`/avoirs/${id}/pdf`, `avoir-${numero}.pdf`);
}

export const AVOIR_STATUT_LABELS: Record<AvoirStatut, string> = {
  BROUILLON: "Brouillon",
  EMIS: "Emis",
};
