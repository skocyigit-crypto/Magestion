import { apiFetch } from "@/lib/api";

export type DevisStatut = "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE";
export type TauxTva = 0 | 5.5 | 10 | 20;

export interface Devis {
  id: string;
  projectId: string | null;
  numero: string;
  client: string;
  objet: string;
  statut: DevisStatut;
  montantHt: string;
  tauxTva: string;
  dateEnvoi: string | null;
  dateReponse: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevisInput {
  client: string;
  objet: string;
  projectId?: string;
  montantHt: number;
  tauxTva: TauxTva;
}

export function listDevis() {
  return apiFetch<Devis[]>("/devis");
}

export function createDevis(input: DevisInput) {
  return apiFetch<Devis>("/devis", { method: "POST", body: JSON.stringify(input) });
}

export function getDevis(id: string) {
  return apiFetch<Devis>(`/devis/${id}`);
}

export function changeDevisStatut(id: string, statut: "ENVOYE" | "ACCEPTE" | "REFUSE") {
  return apiFetch<Devis>(`/devis/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export function convertirEnFacture(id: string) {
  return apiFetch<{ id: string; numero: string }>(`/devis/${id}/convertir-facture`, { method: "POST" });
}

export function montantTtc(montantHt: string | number, tauxTva: string | number): number {
  return Number(montantHt) * (1 + Number(tauxTva) / 100);
}

export const DEVIS_STATUT_LABELS: Record<DevisStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoye",
  ACCEPTE: "Accepte",
  REFUSE: "Refuse",
};

export const TAUX_TVA_OPTIONS: TauxTva[] = [0, 5.5, 10, 20];
