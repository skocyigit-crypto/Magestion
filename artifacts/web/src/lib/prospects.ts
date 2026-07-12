import { apiFetch } from "@/lib/api";

export type ProspectUrgence = "BASSE" | "NORMALE" | "URGENTE" | "TRES_URGENTE";
export type ProspectStatut = "NOUVEAU" | "CONTACTE" | "RDV_PLANIFIE" | "DEVIS_ENVOYE" | "NEGOCIATION" | "GAGNE" | "PERDU";
export type RaisonPerte = "PRIX" | "DELAI" | "CONCURRENT" | "SANS_SUITE" | "AUTRE";

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
  raisonPerte: RaisonPerte | null;
  raisonPerteDetail: string | null;
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

// Le backend renvoie 409 si un prospect actif partage deja le meme
// telephone/email — passer force:true pour creer quand meme.
export function createProspect(input: ProspectInput, force = false) {
  return apiFetch<Prospect>("/prospects", { method: "POST", body: JSON.stringify({ ...input, force }) });
}

export function getProspect(id: string) {
  return apiFetch<Prospect>(`/prospects/${id}`);
}

export function updateProspect(
  id: string,
  input: Partial<ProspectInput> & { statut?: ProspectStatut; active?: boolean; raisonPerte?: RaisonPerte; raisonPerteDetail?: string },
) {
  return apiFetch<Prospect>(`/prospects/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function convertirEnDevis(id: string) {
  return apiFetch<{ id: string; numero: string }>(`/prospects/${id}/convertir-devis`, { method: "POST" });
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

export const RAISON_PERTE_LABELS: Record<RaisonPerte, string> = {
  PRIX: "Prix trop eleve",
  DELAI: "Delai trop long",
  CONCURRENT: "Parti chez un concurrent",
  SANS_SUITE: "Sans suite / injoignable",
  AUTRE: "Autre",
};
