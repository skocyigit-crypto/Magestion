import { apiFetch } from "@/lib/api";

export type AgendaType = "RDV" | "VISITE_CHANTIER" | "APPEL" | "REUNION" | "SIGNATURE" | "LIVRAISON" | "RELANCE" | "AUTRE";
export type AgendaStatut = "PLANIFIE" | "CONFIRME" | "EN_COURS" | "EFFECTUE" | "ANNULE" | "REPORTE";
export type AgendaPriorite = "BASSE" | "NORMALE" | "HAUTE" | "URGENTE";

export interface AgendaEvent {
  id: string;
  titre: string;
  type: AgendaType;
  statut: AgendaStatut;
  priorite: AgendaPriorite;
  dateHeure: string;
  dureeMinutes: number;
  notes: string | null;
  active: boolean;
}

export interface AgendaEventInput {
  titre: string;
  type?: AgendaType;
  priorite?: AgendaPriorite;
  dateHeure: string;
  dureeMinutes?: number;
  notes?: string;
}

export function listAgenda() {
  return apiFetch<AgendaEvent[]>("/agenda");
}

export function createAgendaEvent(input: AgendaEventInput) {
  return apiFetch<AgendaEvent>("/agenda", { method: "POST", body: JSON.stringify(input) });
}

export function updateAgendaStatut(id: string, statut: AgendaStatut) {
  return apiFetch<AgendaEvent>(`/agenda/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
}

export const TYPE_LABELS: Record<AgendaType, string> = {
  RDV: "RDV",
  VISITE_CHANTIER: "Visite chantier",
  APPEL: "Appel",
  REUNION: "Reunion",
  SIGNATURE: "Signature",
  LIVRAISON: "Livraison",
  RELANCE: "Relance",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<AgendaStatut, string> = {
  PLANIFIE: "Planifie",
  CONFIRME: "Confirme",
  EN_COURS: "En cours",
  EFFECTUE: "Effectue",
  ANNULE: "Annule",
  REPORTE: "Reporte",
};
