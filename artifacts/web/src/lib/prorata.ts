import { apiFetch } from "@/lib/api";

export interface ProrataCharge {
  id: string;
  projectId: string;
  libelle: string;
  montantHt: string;
  tauxTva: string;
  dateOperation: string;
  active: boolean;
}

export interface ProrataParticipant {
  lienId: string;
  sousTraitantId: string;
  raisonSociale: string;
}

export interface ProrataOverview {
  participants: ProrataParticipant[];
  charges: ProrataCharge[];
  totalTtc: number;
  partParParticipant: number;
}

export function getProrata(projectId: string) {
  return apiFetch<ProrataOverview>(`/prorata/${projectId}`);
}

export function ajouterParticipant(projectId: string, sousTraitantId: string) {
  return apiFetch<unknown>(`/prorata/${projectId}/participants`, { method: "POST", body: JSON.stringify({ sousTraitantId }) });
}

export function retirerParticipant(lienId: string) {
  return apiFetch<unknown>(`/prorata/participants/${lienId}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
}

export function ajouterCharge(projectId: string, input: { libelle: string; montantHt: number; tauxTva?: 0 | 5.5 | 10 | 20; dateOperation: string }) {
  return apiFetch<ProrataCharge>(`/prorata/${projectId}/charges`, { method: "POST", body: JSON.stringify(input) });
}

export function archiverCharge(id: string) {
  return apiFetch<ProrataCharge>(`/prorata/charges/${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
}
