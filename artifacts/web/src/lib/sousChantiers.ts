import { apiFetch } from "@/lib/api";

export type SousChantierStatut = "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "SUSPENDU";

export interface SousChantier {
  id: string;
  projectId: string;
  nom: string;
  description: string | null;
  budgetEstimeHt: string | null;
  avancementPercent: string;
  statut: SousChantierStatut;
  active: boolean;
}

export interface SousChantierInput {
  projectId: string;
  nom: string;
  description?: string;
  budgetEstimeHt?: number;
}

export function listSousChantiers(projectId: string) {
  return apiFetch<SousChantier[]>(`/sous-chantiers?projectId=${projectId}`);
}

export function createSousChantier(input: SousChantierInput) {
  return apiFetch<SousChantier>("/sous-chantiers", { method: "POST", body: JSON.stringify(input) });
}

export function updateSousChantier(
  id: string,
  input: Partial<Omit<SousChantierInput, "projectId">> & { avancementPercent?: number; statut?: SousChantierStatut; active?: boolean },
) {
  return apiFetch<SousChantier>(`/sous-chantiers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const STATUT_LABELS: Record<SousChantierStatut, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Termine",
  SUSPENDU: "Suspendu",
};
