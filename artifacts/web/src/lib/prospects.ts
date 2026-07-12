import { apiFetch } from "@/lib/api";

export type ProspectUrgence = "BASSE" | "NORMALE" | "URGENTE" | "TRES_URGENTE";
export type ProspectStatut = "NOUVEAU" | "CONTACTE" | "RDV_PLANIFIE" | "DEVIS_ENVOYE" | "NEGOCIATION" | "GAGNE" | "PERDU";

export interface Prospect {
  id: string;
  nom: string;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  codePostal: string | null;
  budgetEstime: string;
  distanceKm: string | null;
  urgence: ProspectUrgence;
  statut: ProspectStatut;
  score: number;
  notes: string | null;
  consentementRgpd: boolean;
  consentementDate: string | null;
  anonymise: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectInput {
  nom: string;
  contact?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  codePostal?: string;
  budgetEstime?: number;
  distanceKm?: number;
  urgence?: ProspectUrgence;
  notes?: string;
}

export function listProspects() {
  return apiFetch<Prospect[]>("/prospects");
}

export function createProspect(input: ProspectInput) {
  return apiFetch<Prospect>("/prospects", { method: "POST", body: JSON.stringify(input) });
}

export function getProspect(id: string) {
  return apiFetch<Prospect>(`/prospects/${id}`);
}

export function updateProspect(
  id: string,
  input: Partial<ProspectInput> & { statut?: ProspectStatut; active?: boolean },
) {
  return apiFetch<Prospect>(`/prospects/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// Ordre du pipeline Kanban (colonnes de gauche a droite).
export const PIPELINE_STAGES: ProspectStatut[] = [
  "NOUVEAU",
  "CONTACTE",
  "RDV_PLANIFIE",
  "DEVIS_ENVOYE",
  "NEGOCIATION",
  "GAGNE",
  "PERDU",
];

export const STATUT_LABELS: Record<ProspectStatut, string> = {
  NOUVEAU: "Nouveau",
  CONTACTE: "Contacte",
  RDV_PLANIFIE: "RDV planifie",
  DEVIS_ENVOYE: "Devis envoye",
  NEGOCIATION: "Negociation",
  GAGNE: "Gagne",
  PERDU: "Perdu",
};

export const URGENCE_LABELS: Record<ProspectUrgence, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  URGENTE: "Urgente",
  TRES_URGENTE: "Tres urgente",
};
