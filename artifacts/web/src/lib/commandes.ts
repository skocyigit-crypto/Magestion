import { apiFetch } from "@/lib/api";

export type CommandeStatut = "BROUILLON" | "ENVOYEE" | "CONFIRMEE" | "LIVREE";

export interface Commande {
  id: string;
  projectId: string | null;
  fournisseur: string;
  fournisseurId: string | null;
  objet: string;
  statut: CommandeStatut;
  montantHt: string;
  tauxTva: string;
  dateLivraisonPrevue: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommandeInput {
  fournisseur: string;
  fournisseurId?: string;
  objet: string;
  projectId?: string;
  montantHt: number;
  tauxTva: 0 | 5.5 | 10 | 20;
  dateLivraisonPrevue?: string;
}

export function listCommandes(onlyInactive = false) {
  return apiFetch<Commande[]>(`/commandes${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createCommande(input: CommandeInput) {
  return apiFetch<Commande>("/commandes", { method: "POST", body: JSON.stringify(input) });
}

export function changeCommandeStatut(id: string, statut: "ENVOYEE" | "CONFIRMEE" | "LIVREE") {
  return apiFetch<Commande>(`/commandes/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export interface CommandeUpdateInput extends Partial<CommandeInput> {
  active?: boolean;
}

export function updateCommande(id: string, input: CommandeUpdateInput) {
  return apiFetch<Commande>(`/commandes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const STATUT_LABELS: Record<CommandeStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyee",
  CONFIRMEE: "Confirmee",
  LIVREE: "Livree",
};

export const NEXT_STATUTS: Record<CommandeStatut, CommandeStatut[]> = {
  BROUILLON: ["ENVOYEE"],
  ENVOYEE: ["CONFIRMEE"],
  CONFIRMEE: ["LIVREE"],
  LIVREE: [],
};
