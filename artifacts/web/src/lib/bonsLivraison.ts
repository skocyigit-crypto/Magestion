import { apiFetch } from "@/lib/api";

export type BonLivraisonStatut = "BROUILLON" | "VALIDE";
export type BonLivraisonConformite = "CONFORME" | "NON_CONFORME" | "PARTIELLE";

export interface BonLivraison {
  id: string;
  commandeId: string;
  numeroBl: number;
  commandeMontantHt: string;
  pourcentageLivre: string;
  montantLivreHt: number;
  statut: BonLivraisonStatut;
  conformite: BonLivraisonConformite;
  dateLivraison: string;
  notes: string | null;
}

export interface BonLivraisonInput {
  commandeId: string;
  pourcentageLivre: number;
  dateLivraison?: string;
  conformite?: BonLivraisonConformite;
  notes?: string;
}

export function listBonsLivraison(commandeId: string) {
  return apiFetch<BonLivraison[]>(`/bons-livraison?commandeId=${commandeId}`);
}

export function createBonLivraison(input: BonLivraisonInput) {
  return apiFetch<BonLivraison>("/bons-livraison", { method: "POST", body: JSON.stringify(input) });
}

export function validerBonLivraison(id: string) {
  return apiFetch<BonLivraison>(`/bons-livraison/${id}/valider`, { method: "POST" });
}

export const CONFORMITE_LABELS: Record<BonLivraisonConformite, string> = {
  CONFORME: "Conforme",
  NON_CONFORME: "Non conforme",
  PARTIELLE: "Partielle",
};
