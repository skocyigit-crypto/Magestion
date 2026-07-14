import { apiFetch } from "@/lib/api";

export interface ArchiveDecennale {
  id: string;
  projectId: string;
  sousTraitantId: string;
  numeroAttestation: string;
  assureur: string;
  activiteCouverte: string | null;
  dateDebutValidite: string;
  dateFinValidite: string;
  documentId: string | null;
  dateDroc: string | null;
  dateCloture: string | null;
  scelle: boolean;
  notes: string | null;
  active: boolean;
}

export interface ArchiveDecennaleInput {
  projectId: string;
  sousTraitantId: string;
  numeroAttestation: string;
  assureur: string;
  activiteCouverte?: string;
  dateDebutValidite: string;
  dateFinValidite: string;
  documentId?: string;
  dateDroc?: string;
  notes?: string;
}

export function listArchivesDecennales(projectId?: string) {
  return apiFetch<ArchiveDecennale[]>(`/archives-decennales${projectId ? `?projectId=${projectId}` : ""}`);
}

export function createArchiveDecennale(input: ArchiveDecennaleInput) {
  return apiFetch<ArchiveDecennale>("/archives-decennales", { method: "POST", body: JSON.stringify(input) });
}

export function updateArchiveDecennale(id: string, input: Partial<ArchiveDecennaleInput> & { active?: boolean }) {
  return apiFetch<ArchiveDecennale>(`/archives-decennales/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function scellerArchiveDecennale(id: string) {
  return apiFetch<ArchiveDecennale>(`/archives-decennales/${id}/sceller`, { method: "POST" });
}

export function isArchiveExpiree(dateFinValidite: string): boolean {
  return new Date(dateFinValidite) < new Date();
}
