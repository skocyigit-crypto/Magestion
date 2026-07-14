import { apiFetch } from "@/lib/api";

export type OsStatut = "NOTIFIE" | "EXECUTE" | "REFUSE" | "RESERVES";
export type TypePv = "OPR" | "RECEPTION" | "RECEPTION_AVEC_RESERVES" | "LEVEE_RESERVES" | "REFUS_RECEPTION";
export type DgdStatut = "BROUILLON" | "ETABLI" | "NOTIFIE" | "ACCEPTE" | "CONTESTE" | "DEFINITIF";
export type TypeGarantie = "GPA" | "BIENNALE" | "DECENNALE" | "CAUTION_DEFINITIVE" | "RETENUE_GARANTIE" | "CAUTION_AVANCE";
export type GarantieStatut = "ACTIVE" | "LEVEE" | "EXPIREE" | "MISE_EN_JEU";
export type SousTraitantMarcheStatut = "PROPOSE" | "ACCEPTE_MOA" | "REFUSE" | "ACTIF" | "TERMINE";

export interface OrdreService {
  id: string;
  marcheId: string;
  lotId: string | null;
  numero: number;
  dateOs: string;
  objet: string;
  prescription: string;
  delaiExecution: string | null;
  incidenceFinanciereHt: string | null;
  statut: OsStatut;
  reserves: string | null;
  notes: string | null;
}

export interface OrdreServiceInput {
  marcheId: string;
  lotId?: string;
  dateOs: string;
  objet: string;
  prescription: string;
  delaiExecution?: string;
  incidenceFinanciereHt?: number;
  notes?: string;
}

export function listOrdresService(marcheId: string) {
  return apiFetch<OrdreService[]>(`/execution-marche/ordres-service?marcheId=${marcheId}`);
}
export function createOrdreService(input: OrdreServiceInput) {
  return apiFetch<OrdreService>("/execution-marche/ordres-service", { method: "POST", body: JSON.stringify(input) });
}
export function updateOrdreService(id: string, input: { statut?: Exclude<OsStatut, "NOTIFIE">; reserves?: string; notes?: string }) {
  return apiFetch<OrdreService>(`/execution-marche/ordres-service/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface PvReception {
  id: string;
  marcheId: string;
  lotId: string | null;
  typePv: TypePv;
  numero: number;
  datePv: string;
  dateEffetReception: string | null;
  reserves: string | null;
  observations: string | null;
  declencheGaranties: boolean;
  notes: string | null;
}

export interface PvReceptionInput {
  marcheId: string;
  lotId?: string;
  typePv: TypePv;
  datePv: string;
  dateEffetReception?: string;
  reserves?: string;
  observations?: string;
  declencheGaranties?: boolean;
  notes?: string;
}

export function listPvReception(marcheId: string) {
  return apiFetch<PvReception[]>(`/execution-marche/pv-reception?marcheId=${marcheId}`);
}
export function createPvReception(input: PvReceptionInput) {
  return apiFetch<PvReception>("/execution-marche/pv-reception", { method: "POST", body: JSON.stringify(input) });
}

export interface DgdMarche {
  id: string;
  marcheId: string;
  lotId: string | null;
  numero: number;
  dateEtablissement: string;
  montantInitialHt: string;
  montantAvenantsHt: string;
  montantRevisionHt: string;
  penalitesHt: string;
  primesHt: string;
  retenueGarantieHt: string;
  totalDgdHt: string;
  tauxTva: string;
  totalDgdTtc: string;
  acomptesPercus: string;
  soldeARegler: string;
  reservesAcceptation: string | null;
  statut: DgdStatut;
  notes: string | null;
}

export interface DgdInput {
  marcheId: string;
  lotId?: string;
  dateEtablissement: string;
  montantInitialHt: number;
  montantAvenantsHt?: number;
  montantRevisionHt?: number;
  penalitesHt?: number;
  primesHt?: number;
  retenueGarantieHt?: number;
  tauxTva: number;
  acomptesPercus?: number;
  notes?: string;
}

export function listDgd(marcheId: string) {
  return apiFetch<DgdMarche[]>(`/execution-marche/dgd?marcheId=${marcheId}`);
}
export function createDgd(input: DgdInput) {
  return apiFetch<DgdMarche>("/execution-marche/dgd", { method: "POST", body: JSON.stringify(input) });
}
export function changeDgdStatut(id: string, statut: Exclude<DgdStatut, "BROUILLON">, reservesAcceptation?: string) {
  return apiFetch<DgdMarche>(`/execution-marche/dgd/${id}/statut`, { method: "POST", body: JSON.stringify({ statut, reservesAcceptation }) });
}

export interface GarantieMarche {
  id: string;
  marcheId: string;
  lotId: string | null;
  typeGarantie: TypeGarantie;
  emetteur: string | null;
  numeroActe: string | null;
  montantHt: string | null;
  pourcentage: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  dateLevee: string | null;
  statut: GarantieStatut;
  notes: string | null;
}

export interface GarantieInput {
  marcheId: string;
  lotId?: string;
  typeGarantie: TypeGarantie;
  emetteur?: string;
  numeroActe?: string;
  montantHt?: number;
  pourcentage?: number;
  dateDebut?: string;
  dateFin?: string;
  notes?: string;
}

export function listGaranties(marcheId: string) {
  return apiFetch<GarantieMarche[]>(`/execution-marche/garanties?marcheId=${marcheId}`);
}
export function createGarantie(input: GarantieInput) {
  return apiFetch<GarantieMarche>("/execution-marche/garanties", { method: "POST", body: JSON.stringify(input) });
}
export function leverGarantie(id: string) {
  return apiFetch<GarantieMarche>(`/execution-marche/garanties/${id}/lever`, { method: "POST" });
}

export interface MarcheSousTraitant {
  id: string;
  marcheId: string;
  lotId: string | null;
  sousTraitantId: string;
  natureTravaux: string;
  montantSousTraiteHt: string;
  paiementDirect: boolean;
  dateDc4: string | null;
  dateAgrement: string | null;
  dateNotification: string | null;
  statut: SousTraitantMarcheStatut;
  motifRefus: string | null;
  notes: string | null;
}

export interface MarcheSousTraitantInput {
  marcheId: string;
  lotId?: string;
  sousTraitantId: string;
  natureTravaux: string;
  montantSousTraiteHt: number;
  paiementDirect?: boolean;
  notes?: string;
}

export function listMarcheSousTraitants(marcheId: string) {
  return apiFetch<MarcheSousTraitant[]>(`/execution-marche/sous-traitants?marcheId=${marcheId}`);
}
export function createMarcheSousTraitant(input: MarcheSousTraitantInput) {
  return apiFetch<MarcheSousTraitant>("/execution-marche/sous-traitants", { method: "POST", body: JSON.stringify(input) });
}
export function changeMarcheSousTraitantStatut(id: string, statut: Exclude<SousTraitantMarcheStatut, "PROPOSE">, motifRefus?: string) {
  return apiFetch<MarcheSousTraitant>(`/execution-marche/sous-traitants/${id}/statut`, { method: "POST", body: JSON.stringify({ statut, motifRefus }) });
}

export const OS_STATUT_LABELS: Record<OsStatut, string> = {
  NOTIFIE: "Notifie",
  EXECUTE: "Execute",
  REFUSE: "Refuse",
  RESERVES: "Reserves",
};

export const TYPE_PV_LABELS: Record<TypePv, string> = {
  OPR: "OPR",
  RECEPTION: "Reception",
  RECEPTION_AVEC_RESERVES: "Reception avec reserves",
  LEVEE_RESERVES: "Levee de reserves",
  REFUS_RECEPTION: "Refus de reception",
};

export const DGD_STATUT_LABELS: Record<DgdStatut, string> = {
  BROUILLON: "Brouillon",
  ETABLI: "Etabli",
  NOTIFIE: "Notifie",
  ACCEPTE: "Accepte",
  CONTESTE: "Conteste",
  DEFINITIF: "Definitif",
};

export const TYPE_GARANTIE_LABELS: Record<TypeGarantie, string> = {
  GPA: "GPA (1 an)",
  BIENNALE: "Biennale (2 ans)",
  DECENNALE: "Decennale (10 ans)",
  CAUTION_DEFINITIVE: "Caution definitive",
  RETENUE_GARANTIE: "Retenue de garantie",
  CAUTION_AVANCE: "Caution sur avance",
};

export const GARANTIE_STATUT_LABELS: Record<GarantieStatut, string> = {
  ACTIVE: "Active",
  LEVEE: "Levee",
  EXPIREE: "Expiree",
  MISE_EN_JEU: "Mise en jeu",
};

export const ST_MARCHE_STATUT_LABELS: Record<SousTraitantMarcheStatut, string> = {
  PROPOSE: "Propose",
  ACCEPTE_MOA: "Accepte par le MOA",
  REFUSE: "Refuse",
  ACTIF: "Actif",
  TERMINE: "Termine",
};
