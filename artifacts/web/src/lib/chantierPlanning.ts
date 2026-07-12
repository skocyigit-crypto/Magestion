import { apiFetch } from "@/lib/api";

export interface ChantierPhase {
  id: string;
  projectId: string;
  nom: string;
  dateDebut: string;
  dateFin: string;
  avancementPercent: string;
  ordre: number;
  active: boolean;
}

export interface ChantierPhaseInput {
  nom: string;
  dateDebut: string;
  dateFin: string;
  avancementPercent?: number;
  ordre?: number;
}

export interface ChantierPhaseUpdateInput extends Partial<ChantierPhaseInput> {
  active?: boolean;
}

export function listChantierPhases(projectId: string, onlyInactive = false) {
  return apiFetch<ChantierPhase[]>(`/planning-chantier/${projectId}${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createChantierPhase(projectId: string, input: ChantierPhaseInput) {
  return apiFetch<ChantierPhase>(`/planning-chantier/${projectId}`, { method: "POST", body: JSON.stringify(input) });
}

export function updateChantierPhase(id: string, input: ChantierPhaseUpdateInput) {
  return apiFetch<ChantierPhase>(`/planning-chantier/phases/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
