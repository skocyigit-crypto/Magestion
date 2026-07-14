import { apiFetch } from "@/lib/api";

export type TypeDechet = "INERTES" | "NON_DANGEREUX_NON_INERTES" | "DANGEREUX";
export type DestinationDechet = "REEMPLOI" | "RECYCLAGE" | "VALORISATION_ENERGETIQUE" | "ELIMINATION" | "STOCKAGE";

export interface DechetChantier {
  id: string;
  projectId: string;
  typeDechet: TypeDechet;
  natureDechet: string;
  quantite: string;
  unite: string;
  collecteur: string | null;
  fournisseurId: string | null;
  dateEnlevement: string;
  destination: DestinationDechet;
  bordereauNumero: string | null;
  notes: string | null;
  active: boolean;
}

export interface DechetChantierInput {
  projectId: string;
  typeDechet: TypeDechet;
  natureDechet: string;
  quantite: number;
  unite?: string;
  collecteur?: string;
  fournisseurId?: string;
  dateEnlevement: string;
  destination?: DestinationDechet;
  bordereauNumero?: string;
  notes?: string;
}

export function listDechetsChantier(projectId?: string) {
  return apiFetch<DechetChantier[]>(`/gestion-dechets${projectId ? `?projectId=${projectId}` : ""}`);
}

export function createDechetChantier(input: DechetChantierInput) {
  return apiFetch<DechetChantier>("/gestion-dechets", { method: "POST", body: JSON.stringify(input) });
}

export function updateDechetChantier(id: string, input: Partial<DechetChantierInput> & { active?: boolean }) {
  return apiFetch<DechetChantier>(`/gestion-dechets/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const TYPE_DECHET_LABELS: Record<TypeDechet, string> = {
  INERTES: "Inertes (beton, gravats)",
  NON_DANGEREUX_NON_INERTES: "Non dangereux non inertes (bois, platre)",
  DANGEREUX: "Dangereux (amiante, solvants)",
};

export const DESTINATION_LABELS: Record<DestinationDechet, string> = {
  REEMPLOI: "Reemploi",
  RECYCLAGE: "Recyclage",
  VALORISATION_ENERGETIQUE: "Valorisation energetique",
  ELIMINATION: "Elimination",
  STOCKAGE: "Stockage",
};
