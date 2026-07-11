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

export function listIncidents() {
  return apiFetch<Incident[]>("/securite");
}

export function createIncident(input: IncidentInput) {
  return apiFetch<Incident>("/securite", { method: "POST", body: JSON.stringify(input) });
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
