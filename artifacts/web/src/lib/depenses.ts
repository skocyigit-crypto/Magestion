import { apiFetch } from "@/lib/api";

export type DepenseCategorie = "MATERIAUX" | "MAIN_OEUVRE" | "SOUS_TRAITANCE" | "MATERIEL" | "ADMINISTRATIF" | "AUTRE";
export type DepenseStatut = "A_VALIDER" | "BON_A_PAYER" | "PAYEE" | "EN_LITIGE";

export interface Depense {
  id: string;
  projectId: string | null;
  fournisseur: string;
  categorie: DepenseCategorie;
  objet: string;
  statut: DepenseStatut;
  montantHt: string;
  tauxTva: string;
  dateEcheance: string | null;
  datePaiement: string | null;
  autoliquidation: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DepenseInput {
  fournisseur: string;
  objet: string;
  projectId?: string;
  categorie?: DepenseCategorie;
  montantHt: number;
  tauxTva: 0 | 5.5 | 10 | 20;
  autoliquidation?: boolean;
  dateEcheance?: string;
}

export function listDepenses() {
  return apiFetch<Depense[]>("/depenses");
}

export function createDepense(input: DepenseInput) {
  return apiFetch<Depense>("/depenses", { method: "POST", body: JSON.stringify(input) });
}

export function changeDepenseStatut(id: string, statut: "BON_A_PAYER" | "PAYEE" | "EN_LITIGE") {
  return apiFetch<Depense>(`/depenses/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export const CATEGORIE_LABELS: Record<DepenseCategorie, string> = {
  MATERIAUX: "Materiaux",
  MAIN_OEUVRE: "Main d'oeuvre",
  SOUS_TRAITANCE: "Sous-traitance",
  MATERIEL: "Materiel",
  ADMINISTRATIF: "Administratif",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<DepenseStatut, string> = {
  A_VALIDER: "A valider",
  BON_A_PAYER: "Bon a payer",
  PAYEE: "Payee",
  EN_LITIGE: "En litige",
};

export const NEXT_STATUTS: Record<DepenseStatut, DepenseStatut[]> = {
  A_VALIDER: ["BON_A_PAYER", "EN_LITIGE"],
  BON_A_PAYER: ["PAYEE", "EN_LITIGE"],
  EN_LITIGE: ["BON_A_PAYER"],
  PAYEE: [],
};
