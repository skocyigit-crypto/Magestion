import { apiFetch } from "@/lib/api";

export type FactureStatut = "BROUILLON" | "ENVOYEE" | "PAYEE" | "EN_RETARD";

export interface Facture {
  id: string;
  projectId: string | null;
  devisId: string | null;
  numero: string;
  client: string;
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

export function listFactures() {
  return apiFetch<Facture[]>("/factures");
}

export function getFacture(id: string) {
  return apiFetch<Facture>(`/factures/${id}`);
}

export function changeFactureStatut(id: string, statut: "ENVOYEE" | "PAYEE" | "EN_RETARD") {
  return apiFetch<Facture>(`/factures/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export const FACTURE_STATUT_LABELS: Record<FactureStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyee",
  PAYEE: "Payee",
  EN_RETARD: "En retard",
};
