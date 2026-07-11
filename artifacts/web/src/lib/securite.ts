import { apiFetch } from "@/lib/api";

export type Gravite = "FAIBLE" | "MOYENNE" | "ELEVEE" | "CRITIQUE";

export interface Incident {
  id: string;
  titre: string;
  description: string | null;
  typeIncident: string;
  gravite: Gravite;
  dateIncident: string;
  projectId: string | null;
  active: boolean;
}

export interface IncidentInput {
  titre: string;
  description?: string;
  typeIncident: string;
  gravite?: Gravite;
  projectId?: string;
}

export function listIncidents(onlyInactive = false) {
  return apiFetch<Incident[]>(`/securite${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createIncident(input: IncidentInput) {
  return apiFetch<Incident>("/securite", { method: "POST", body: JSON.stringify(input) });
}

export interface IncidentUpdateInput extends Partial<IncidentInput> {
  active?: boolean;
}

export function updateIncident(id: string, input: IncidentUpdateInput) {
  return apiFetch<Incident>(`/securite/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const GRAVITE_LABELS: Record<Gravite, string> = {
  FAIBLE: "Faible",
  MOYENNE: "Moyenne",
  ELEVEE: "Elevee",
  CRITIQUE: "Critique",
};

export const GRAVITE_COLORS: Record<Gravite, string> = {
  FAIBLE: "text-muted-foreground",
  MOYENNE: "text-primary",
  ELEVEE: "text-orange-400",
  CRITIQUE: "text-red-400",
};
