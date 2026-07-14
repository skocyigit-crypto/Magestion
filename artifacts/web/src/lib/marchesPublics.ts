import { apiFetch } from "@/lib/api";

export type MarcheType = "TRAVAUX" | "SERVICES" | "FOURNITURES";
export type MarcheStatut = "EN_COURS" | "TERMINE" | "RESILIE" | "SUSPENDU";
export type AvenantType = "REVISION_PRIX" | "TRAVAUX_SUPPLEMENTAIRES" | "PROLONGATION_DELAI" | "AUTRE";
export type AvenantStatut = "BROUILLON" | "SIGNE" | "TRANSMIS" | "IMPUTE";

export interface MarchePublic {
  id: string;
  numero: string;
  intitule: string;
  clientId: string;
  projectId: string | null;
  devisId: string | null;
  typeMarche: MarcheType;
  procedureType: string;
  montantInitialHt: string;
  montantActuelHt: string;
  tauxTva: string;
  dateNotification: string | null;
  dateDebutTravaux: string | null;
  dateFinPrevue: string | null;
  dateReception: string | null;
  delaiExecutionMois: number | null;
  clauseRevisionPrix: boolean;
  indiceReference: string | null;
  valeurIndiceMoisZero: string | null;
  cautionDefinitivePourcent: string | null;
  retenueGarantiePourcent: string | null;
  delaiGarantieMois: number | null;
  penalitesRetardJour: string | null;
  plafondPenalitesPourcent: string | null;
  statut: MarcheStatut;
  notes: string | null;
  active: boolean;
}

export interface MarcheInput {
  intitule: string;
  clientId: string;
  projectId?: string;
  devisId?: string;
  typeMarche?: MarcheType;
  procedureType?: string;
  montantInitialHt: number;
  tauxTva: number;
  dateNotification?: string;
  dateDebutTravaux?: string;
  dateFinPrevue?: string;
  delaiExecutionMois?: number;
  clauseRevisionPrix?: boolean;
  indiceReference?: string;
  valeurIndiceMoisZero?: number;
  cautionDefinitivePourcent?: number;
  retenueGarantiePourcent?: number;
  delaiGarantieMois?: number;
  penalitesRetardJour?: number;
  plafondPenalitesPourcent?: number;
  notes?: string;
}

export interface Avenant {
  id: string;
  marcheId: string;
  numero: number;
  typeAvenant: AvenantType;
  objet: string;
  montantHt: string;
  indiceBase: string | null;
  indiceActuel: string | null;
  coefficientRevision: string | null;
  dateSignature: string | null;
  statut: AvenantStatut;
  modeTransmission: string | null;
  dateTransmission: string | null;
  dateImputation: string | null;
  justification: string | null;
  notes: string | null;
}

export interface AvenantInput {
  typeAvenant?: AvenantType;
  objet: string;
  montantHt: number;
  indiceBase?: number;
  indiceActuel?: number;
  coefficientRevision?: number;
  justification?: string;
  notes?: string;
}

export function listMarchesPublics(onlyInactive = false) {
  return apiFetch<MarchePublic[]>(`/marches-publics${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function getMarchePublic(id: string) {
  return apiFetch<MarchePublic>(`/marches-publics/${id}`);
}

export function createMarchePublic(input: MarcheInput) {
  return apiFetch<MarchePublic>("/marches-publics", { method: "POST", body: JSON.stringify(input) });
}

export function updateMarchePublic(id: string, input: Partial<MarcheInput> & { active?: boolean; dateReception?: string }) {
  return apiFetch<MarchePublic>(`/marches-publics/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function changeMarcheStatut(id: string, statut: MarcheStatut) {
  return apiFetch<MarchePublic>(`/marches-publics/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export function listAvenants(marcheId: string) {
  return apiFetch<Avenant[]>(`/marches-publics/${marcheId}/avenants`);
}

export function createAvenant(marcheId: string, input: AvenantInput) {
  return apiFetch<Avenant>(`/marches-publics/${marcheId}/avenants`, { method: "POST", body: JSON.stringify(input) });
}

export function changeAvenantStatut(
  marcheId: string,
  avenantId: string,
  statut: Exclude<AvenantStatut, "BROUILLON">,
  modeTransmission?: "mail" | "courrier_ar" | "main_propre",
) {
  return apiFetch<Avenant>(`/marches-publics/${marcheId}/avenants/${avenantId}/statut`, {
    method: "POST",
    body: JSON.stringify({ statut, modeTransmission }),
  });
}

export const TYPE_MARCHE_LABELS: Record<MarcheType, string> = {
  TRAVAUX: "Travaux",
  SERVICES: "Services",
  FOURNITURES: "Fournitures",
};

export const MARCHE_STATUT_LABELS: Record<MarcheStatut, string> = {
  EN_COURS: "En cours",
  TERMINE: "Termine",
  RESILIE: "Resilie",
  SUSPENDU: "Suspendu",
};

export const AVENANT_TYPE_LABELS: Record<AvenantType, string> = {
  REVISION_PRIX: "Revision de prix",
  TRAVAUX_SUPPLEMENTAIRES: "Travaux supplementaires",
  PROLONGATION_DELAI: "Prolongation de delai",
  AUTRE: "Autre",
};

export const AVENANT_STATUT_LABELS: Record<AvenantStatut, string> = {
  BROUILLON: "Brouillon",
  SIGNE: "Signe",
  TRANSMIS: "Transmis",
  IMPUTE: "Impute",
};
