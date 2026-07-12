import { apiFetch } from "@/lib/api";

export interface Fournisseur {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  siret: string | null;
  tvaIntracommunautaire: string | null;
  iban: string | null;
  bic: string | null;
  conditionsPaiement: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface FournisseurInput {
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  tvaIntracommunautaire?: string;
  iban?: string;
  bic?: string;
  conditionsPaiement?: string;
  notes?: string;
}

export interface FournisseurUpdateInput extends Partial<FournisseurInput> {
  active?: boolean;
}

export interface FournisseurHistorique {
  commandes: { id: string; objet: string; statut: string; montantHt: string }[];
  depenses: { id: string; objet: string; statut: string; montantHt: string }[];
  totalCommandesHt: number;
  totalDepensesHt: number;
  totalEngageHt: number;
}

export function listFournisseurs(onlyInactive = false) {
  return apiFetch<Fournisseur[]>(`/fournisseurs${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createFournisseur(input: FournisseurInput) {
  return apiFetch<Fournisseur>("/fournisseurs", { method: "POST", body: JSON.stringify(input) });
}

export function getFournisseur(id: string) {
  return apiFetch<Fournisseur>(`/fournisseurs/${id}`);
}

export function updateFournisseur(id: string, input: FournisseurUpdateInput) {
  return apiFetch<Fournisseur>(`/fournisseurs/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getFournisseurHistorique(id: string) {
  return apiFetch<FournisseurHistorique>(`/fournisseurs/${id}/historique`);
}
