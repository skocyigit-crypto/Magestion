import { apiFetch } from "@/lib/api";
import type { Commande } from "@/lib/commandes";

export type DemandeAchatStatut = "EN_ATTENTE" | "APPROUVEE" | "REJETEE" | "CONVERTIE";

export interface DemandeAchat {
  id: string;
  projectId: string | null;
  demandeurId: string | null;
  objet: string;
  quantiteEstimee: string | null;
  montantEstimeHt: string | null;
  statut: DemandeAchatStatut;
  motifRejet: string | null;
  commandeId: string | null;
  notes: string | null;
  active: boolean;
}

export interface DemandeAchatInput {
  projectId?: string;
  demandeurId?: string;
  objet: string;
  quantiteEstimee?: string;
  montantEstimeHt?: number;
  notes?: string;
}

export interface ConvertirCommandeInput {
  fournisseur: string;
  fournisseurId?: string;
  montantHt: number;
  tauxTva: 0 | 5.5 | 10 | 20;
  dateLivraisonPrevue?: string;
}

export function listDemandesAchat(onlyInactive = false) {
  return apiFetch<DemandeAchat[]>(`/demandes-achat${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createDemandeAchat(input: DemandeAchatInput) {
  return apiFetch<DemandeAchat>("/demandes-achat", { method: "POST", body: JSON.stringify(input) });
}

export function updateDemandeAchat(id: string, input: Partial<DemandeAchatInput> & { active?: boolean }) {
  return apiFetch<DemandeAchat>(`/demandes-achat/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function approuverDemandeAchat(id: string) {
  return apiFetch<DemandeAchat>(`/demandes-achat/${id}/approuver`, { method: "POST" });
}

export function rejeterDemandeAchat(id: string, motifRejet?: string) {
  return apiFetch<DemandeAchat>(`/demandes-achat/${id}/rejeter`, { method: "POST", body: JSON.stringify({ motifRejet }) });
}

export function convertirDemandeEnCommande(id: string, input: ConvertirCommandeInput) {
  return apiFetch<{ demande: DemandeAchat; commande: Commande }>(`/demandes-achat/${id}/convertir-commande`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const STATUT_LABELS: Record<DemandeAchatStatut, string> = {
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvee",
  REJETEE: "Rejetee",
  CONVERTIE: "Convertie",
};
