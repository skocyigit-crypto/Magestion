import { apiFetch, downloadFile } from "@/lib/api";

export type DevisStatut = "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE";
export type TauxTva = 0 | 5.5 | 10 | 20;

export interface Devis {
  id: string;
  projectId: string | null;
  numero: string;
  client: string;
  clientEmail: string | null;
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
  clientEmail?: string;
  objet: string;
  projectId?: string;
  montantHt: number;
  tauxTva: TauxTva;
}

export interface StatutChangeResult extends Devis {
  emailSent?: boolean;
  emailError?: string;
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

// Le backend refuse cette requete (423) une fois le devis hors BROUILLON.
export function updateDevis(id: string, input: Partial<DevisInput>) {
  return apiFetch<Devis>(`/devis/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function changeDevisStatut(id: string, statut: "ENVOYE" | "ACCEPTE" | "REFUSE") {
  return apiFetch<StatutChangeResult>(`/devis/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export function convertirEnFacture(id: string) {
  return apiFetch<{ id: string; numero: string }>(`/devis/${id}/convertir-facture`, { method: "POST" });
}

export function downloadDevisPdf(id: string, numero: string) {
  return downloadFile(`/devis/${id}/pdf`, `devis-${numero}.pdf`);
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
