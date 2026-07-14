import { apiFetch } from "@/lib/api";

export type ProjectCategorie = "RENOVATION" | "CONSTRUCTION_NEUVE" | "ISOLATION" | "EXTENSION" | "AUTRE";
export type ProjectStatut = "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "SUSPENDU";

export interface Project {
  id: string;
  nom: string;
  client: string;
  clientId: string | null;
  adresse: string | null;
  codePostal: string | null;
  budgetEstimeHt: string;
  objectifMargePercent: string;
  categorie: ProjectCategorie;
  statut: ProjectStatut;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  nom: string;
  client: string;
  clientId?: string;
  adresse?: string;
  codePostal?: string;
  budgetEstimeHt?: number;
  objectifMargePercent?: number;
  categorie?: ProjectCategorie;
}

export function listProjects() {
  return apiFetch<Project[]>("/projects");
}

export function createProject(input: ProjectInput) {
  return apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function getProject(id: string) {
  return apiFetch<Project>(`/projects/${id}`);
}

export function updateProject(id: string, input: Partial<ProjectInput> & { statut?: ProjectStatut; active?: boolean }) {
  return apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface ProjectRentabilite {
  revenuHt: number;
  coutMateriauxHt: number;
  coutMainOeuvreHt: number;
  coutTotalHt: number;
  margeReelleHt: number;
  margeReellePercent: number | null;
  heuresTravaillees: number;
  objectifMargePercent: number;
}

export function getProjectRentabilite(id: string) {
  return apiFetch<ProjectRentabilite>(`/projects/${id}/rentabilite`);
}

export const CATEGORIE_LABELS: Record<ProjectCategorie, string> = {
  RENOVATION: "Renovation",
  CONSTRUCTION_NEUVE: "Construction neuve",
  ISOLATION: "Isolation",
  EXTENSION: "Extension",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<ProjectStatut, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Termine",
  SUSPENDU: "Suspendu",
};
