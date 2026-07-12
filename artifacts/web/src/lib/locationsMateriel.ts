import { apiFetch } from "@/lib/api";

export type LocationMaterielStatut = "EN_COURS" | "TERMINEE";

export interface LocationMateriel {
  id: string;
  projectId: string | null;
  designation: string;
  fournisseur: string;
  dateDebut: string;
  dateFin: string | null;
  coutJournalierHt: string;
  statut: LocationMaterielStatut;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationMaterielInput {
  projectId?: string;
  designation: string;
  fournisseur: string;
  dateDebut: string;
  dateFin?: string;
  coutJournalierHt: number;
}

export function listLocationsMateriel(onlyInactive = false) {
  return apiFetch<LocationMateriel[]>(`/locations-materiel${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createLocationMateriel(input: LocationMaterielInput) {
  return apiFetch<LocationMateriel>("/locations-materiel", { method: "POST", body: JSON.stringify(input) });
}

export interface LocationMaterielUpdateInput extends Partial<LocationMaterielInput> {
  statut?: LocationMaterielStatut;
  active?: boolean;
}

export function updateLocationMateriel(id: string, input: LocationMaterielUpdateInput) {
  return apiFetch<LocationMateriel>(`/locations-materiel/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const STATUT_LABELS: Record<LocationMaterielStatut, string> = {
  EN_COURS: "En cours",
  TERMINEE: "Terminee",
};
