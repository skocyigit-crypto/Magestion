import { apiFetch } from "@/lib/api";

export type EtapeClotureStatut = "A_FAIRE" | "EN_COURS" | "FAIT" | "BLOQUE";

export interface EtapeCloture {
  id: string;
  exercice: string;
  ordre: number;
  titre: string;
  description: string | null;
  obligatoire: boolean;
  statut: EtapeClotureStatut;
  dateRealisation: string | null;
  notes: string | null;
}

export interface ClotureStats {
  total: number;
  nbFait: number;
  nbEnCours: number;
  nbAFaire: number;
  nbBloque: number;
  progression: number;
  prochaineEtape: string | null;
  pretPourCloture: boolean;
}

export function listEtapesCloture(exercice: string) {
  return apiFetch<EtapeCloture[]>(`/cloture-comptable?exercice=${exercice}`);
}

export function getClotureStats(exercice: string) {
  return apiFetch<ClotureStats>(`/cloture-comptable/stats?exercice=${exercice}`);
}

export function updateEtapeCloture(id: string, input: { statut?: EtapeClotureStatut; notes?: string }) {
  return apiFetch<EtapeCloture>(`/cloture-comptable/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function reinitialiserCloture(exercice: string) {
  return apiFetch<EtapeCloture[]>("/cloture-comptable/reinitialiser", { method: "POST", body: JSON.stringify({ exercice }) });
}

export const STATUT_LABELS: Record<EtapeClotureStatut, string> = {
  A_FAIRE: "A faire",
  EN_COURS: "En cours",
  FAIT: "Fait",
  BLOQUE: "Bloque",
};
