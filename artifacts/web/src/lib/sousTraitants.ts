import { apiFetch } from "@/lib/api";

export interface SousTraitant {
  id: string;
  raisonSociale: string;
  siret: string;
  specialite: string | null;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  assuranceDecennaleValidite: string | null;
  urssafValidite: string | null;
  active: boolean;
}

export interface SousTraitantInput {
  raisonSociale: string;
  siret: string;
  specialite?: string;
  contact?: string;
  telephone?: string;
  email?: string;
  assuranceDecennaleValidite?: string;
  urssafValidite?: string;
}

export interface SousTraitantUpdateInput extends Partial<SousTraitantInput> {
  active?: boolean;
}

export function listSousTraitants(onlyInactive = false) {
  return apiFetch<SousTraitant[]>(`/sous-traitants${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createSousTraitant(input: SousTraitantInput) {
  return apiFetch<SousTraitant>("/sous-traitants", { method: "POST", body: JSON.stringify(input) });
}

export function updateSousTraitant(id: string, input: SousTraitantUpdateInput) {
  return apiFetch<SousTraitant>(`/sous-traitants/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function isAssuranceExpiree(dateStr: string | null): boolean {
  if (!dateStr) return true;
  return new Date(dateStr) < new Date();
}
