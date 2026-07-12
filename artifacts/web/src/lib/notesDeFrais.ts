import { apiFetch } from "@/lib/api";

export type NoteFraisCategorie = "DEPLACEMENT" | "REPAS" | "MATERIEL" | "HEBERGEMENT" | "AUTRE";
export type NoteFraisStatut = "SOUMISE" | "VALIDEE" | "REMBOURSEE" | "REFUSEE";

export interface NoteFrais {
  id: string;
  employeeId: string;
  projectId: string | null;
  dateDepense: string;
  categorie: NoteFraisCategorie;
  motif: string;
  montant: string;
  statut: NoteFraisStatut;
  dateRemboursement: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFraisInput {
  employeeId: string;
  projectId?: string;
  dateDepense: string;
  categorie?: NoteFraisCategorie;
  motif: string;
  montant: number;
}

export function listNotesDeFrais(onlyInactive = false) {
  return apiFetch<NoteFrais[]>(`/notes-de-frais${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createNoteFrais(input: NoteFraisInput) {
  return apiFetch<NoteFrais>("/notes-de-frais", { method: "POST", body: JSON.stringify(input) });
}

export function changeNoteFraisStatut(id: string, statut: NoteFraisStatut) {
  return apiFetch<NoteFrais>(`/notes-de-frais/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export function archiveNoteFrais(id: string, active: boolean) {
  return apiFetch<NoteFrais>(`/notes-de-frais/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export const CATEGORIE_LABELS: Record<NoteFraisCategorie, string> = {
  DEPLACEMENT: "Deplacement",
  REPAS: "Repas",
  MATERIEL: "Materiel",
  HEBERGEMENT: "Hebergement",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<NoteFraisStatut, string> = {
  SOUMISE: "Soumise",
  VALIDEE: "Validee",
  REMBOURSEE: "Remboursee",
  REFUSEE: "Refusee",
};

export const NEXT_STATUTS: Record<NoteFraisStatut, NoteFraisStatut[]> = {
  SOUMISE: ["VALIDEE", "REFUSEE"],
  VALIDEE: ["REMBOURSEE", "REFUSEE"],
  REFUSEE: ["SOUMISE"],
  REMBOURSEE: [],
};
