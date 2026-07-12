import { apiFetch } from "@/lib/api";

export type ImmobilisationCategorie = "MATERIEL" | "VEHICULE" | "INFORMATIQUE" | "MOBILIER" | "OUTILLAGE" | "AUTRE";
export type ImmobilisationStatut = "EN_SERVICE" | "CEDE" | "REBUT";

export interface Immobilisation {
  id: string;
  code: string;
  designation: string;
  categorie: ImmobilisationCategorie;
  compteComptable: string;
  dateAcquisition: string;
  dateMiseEnService: string | null;
  valeurAcquisition: string;
  dureeAmortissement: number;
  fournisseurId: string | null;
  localisation: string | null;
  affecteA: string | null;
  statut: ImmobilisationStatut;
  dateCession: string | null;
  valeurCession: string | null;
  notes: string | null;
  active: boolean;
  amortissementCumule: number;
  valeurNetteComptable: number;
  dotationAnnuelle: number;
}

export interface ImmobilisationInput {
  designation: string;
  categorie?: ImmobilisationCategorie;
  compteComptable?: string;
  dateAcquisition: string;
  dateMiseEnService?: string;
  valeurAcquisition: number;
  dureeAmortissement?: number;
  fournisseurId?: string;
  localisation?: string;
  affecteA?: string;
  notes?: string;
}

export interface ImmobilisationUpdateInput extends Partial<ImmobilisationInput> {
  statut?: ImmobilisationStatut;
  dateCession?: string;
  valeurCession?: number;
  active?: boolean;
}

export interface ImmobilisationStats {
  total: number;
  totalAcquisition: number;
  totalAmortCumule: number;
  totalVNC: number;
  totalDotation: number;
  enService: number;
  cede: number;
  rebut: number;
  parCategorie: Record<string, { count: number; valeur: number; vnc: number }>;
}

export interface PlanAmortissement {
  id: string;
  code: string;
  designation: string;
  plan: { annee: number; dotation: number; cumul: number; vnc: number; prorata: number }[];
}

export function listImmobilisations(onlyInactive = false) {
  return apiFetch<Immobilisation[]>(`/immobilisations${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function getImmobilisationStats() {
  return apiFetch<ImmobilisationStats>("/immobilisations/stats");
}

export function createImmobilisation(input: ImmobilisationInput) {
  return apiFetch<Immobilisation>("/immobilisations", { method: "POST", body: JSON.stringify(input) });
}

export function updateImmobilisation(id: string, input: ImmobilisationUpdateInput) {
  return apiFetch<Immobilisation>(`/immobilisations/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getPlanAmortissement(id: string) {
  return apiFetch<PlanAmortissement>(`/immobilisations/${id}/plan`);
}

export const CATEGORIE_LABELS: Record<ImmobilisationCategorie, string> = {
  MATERIEL: "Materiel",
  VEHICULE: "Vehicule",
  INFORMATIQUE: "Informatique",
  MOBILIER: "Mobilier",
  OUTILLAGE: "Outillage",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<ImmobilisationStatut, string> = {
  EN_SERVICE: "En service",
  CEDE: "Cede",
  REBUT: "Rebut",
};
