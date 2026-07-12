import { apiFetch } from "@/lib/api";

export type TachePriorite = "BASSE" | "NORMALE" | "HAUTE" | "URGENTE";
export type TacheStatut = "A_FAIRE" | "EN_COURS" | "TERMINEE" | "ANNULEE";

export interface Tache {
  id: string;
  titre: string;
  description: string | null;
  priorite: TachePriorite;
  statut: TacheStatut;
  projectId: string | null;
  assigneId: string | null;
  echeance: string | null;
  active: boolean;
  createdAt: string;
}

export interface TacheInput {
  titre: string;
  description?: string;
  priorite?: TachePriorite;
  projectId?: string;
  assigneId?: string;
  echeance?: string;
}

export interface TacheUpdateInput extends Partial<TacheInput> {
  statut?: TacheStatut;
  active?: boolean;
}

export function listTaches(onlyInactive = false) {
  return apiFetch<Tache[]>(`/taches${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createTache(input: TacheInput) {
  return apiFetch<Tache>("/taches", { method: "POST", body: JSON.stringify(input) });
}

export function updateTache(id: string, input: TacheUpdateInput) {
  return apiFetch<Tache>(`/taches/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const PRIORITE_LABELS: Record<TachePriorite, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

export const STATUT_LABELS: Record<TacheStatut, string> = {
  A_FAIRE: "A faire",
  EN_COURS: "En cours",
  TERMINEE: "Terminee",
  ANNULEE: "Annulee",
};
