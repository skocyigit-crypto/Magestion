import { apiFetch } from "@/lib/api";

export type SituationStatut = "BROUILLON" | "VALIDEE";

export interface Situation {
  id: string;
  projectId: string;
  numeroSituation: number;
  marcheHt: string;
  avancementPercent: string;
  tauxTva: string;
  tauxRetenueGarantie: string;
  statut: SituationStatut;
  dateSituation: string;
  active: boolean;
  montantCumulHt: number;
  montantPeriodeHt: number;
  montantPeriodeTva: number;
  montantPeriodeTtc: number;
  montantRetenueGarantie: number;
  montantNetAPayer: number;
}

export interface SituationInput {
  projectId: string;
  marcheHt: number;
  avancementPercent: number;
  tauxTva?: 0 | 5.5 | 10 | 20;
  tauxRetenueGarantie?: number;
}

export function listSituations(projectId: string) {
  return apiFetch<Situation[]>(`/situations?projectId=${projectId}`);
}

export function createSituation(input: SituationInput) {
  return apiFetch<Situation>("/situations", { method: "POST", body: JSON.stringify(input) });
}

export function validerSituation(id: string) {
  return apiFetch<Situation>(`/situations/${id}/valider`, { method: "POST" });
}

// Uniquement possible tant que statut === "BROUILLON" (verrouillage a la validation, cote serveur).
export function updateSituation(id: string, input: Partial<Omit<SituationInput, "projectId">>) {
  return apiFetch<Situation>(`/situations/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const STATUT_LABELS: Record<SituationStatut, string> = {
  BROUILLON: "Brouillon",
  VALIDEE: "Validee",
};
