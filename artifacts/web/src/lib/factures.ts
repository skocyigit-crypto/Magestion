import { apiFetch, downloadFile } from "@/lib/api";

export type FactureStatut = "BROUILLON" | "ENVOYEE" | "PAYEE" | "EN_RETARD";

export interface Facture {
  id: string;
  projectId: string | null;
  devisId: string | null;
  numero: string;
  client: string;
  clientEmail: string | null;
  objet: string;
  statut: FactureStatut;
  montantHt: string;
  tauxTva: string;
  dateEcheance: string | null;
  datePaiement: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FactureStatutChangeResult extends Facture {
  emailSent?: boolean;
  emailError?: string;
}

export function listFactures() {
  return apiFetch<Facture[]>("/factures");
}

export function getFacture(id: string) {
  return apiFetch<Facture>(`/factures/${id}`);
}

export function changeFactureStatut(id: string, statut: "ENVOYEE" | "PAYEE" | "EN_RETARD") {
  return apiFetch<FactureStatutChangeResult>(`/factures/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export interface FactureUpdateInput {
  objet?: string;
  clientEmail?: string;
  montantHt?: number;
  tauxTva?: 0 | 5.5 | 10 | 20;
  dateEcheance?: string;
}

// Le backend renvoie 423 si la facture n'est plus BROUILLON (immutabilite post-emission).
export function updateFacture(id: string, input: FactureUpdateInput) {
  return apiFetch<Facture>(`/factures/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function downloadFacturePdf(id: string, numero: string) {
  return downloadFile(`/factures/${id}/pdf`, `facture-${numero}.pdf`);
}

export const FACTURE_STATUT_LABELS: Record<FactureStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyee",
  PAYEE: "Payee",
  EN_RETARD: "En retard",
};
