import { apiFetch } from "@/lib/api";
import type { MarchePublic } from "@/lib/marchesPublics";

export type ProcedureType = "MAPA" | "AOO" | "AOR" | "DIALOGUE_COMPETITIF" | "NEGOCIEE";
export type AppelOffreStatut = "VEILLE" | "EN_PREPARATION" | "DEPOSE" | "RETENU" | "REJETE" | "GAGNE" | "PERDU";

export interface AppelOffre {
  id: string;
  reference: string | null;
  intitule: string;
  organisme: string | null;
  clientId: string | null;
  typeProcedure: ProcedureType;
  datePublication: string | null;
  dateLimiteDepot: string | null;
  lieu: string | null;
  categorie: string | null;
  montantEstimeHt: string | null;
  montantOffreHt: string | null;
  delaiProposeJours: number | null;
  statut: AppelOffreStatut;
  motifRejet: string | null;
  marcheId: string | null;
  notes: string | null;
  active: boolean;
}

export interface AppelOffreInput {
  reference?: string;
  intitule: string;
  organisme?: string;
  clientId?: string;
  typeProcedure?: ProcedureType;
  datePublication?: string;
  dateLimiteDepot?: string;
  lieu?: string;
  categorie?: string;
  montantEstimeHt?: number;
  montantOffreHt?: number;
  delaiProposeJours?: number;
  notes?: string;
}

export function listAppelsOffres(onlyInactive = false) {
  return apiFetch<AppelOffre[]>(`/appels-offres${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function getAppelOffre(id: string) {
  return apiFetch<AppelOffre>(`/appels-offres/${id}`);
}

export function createAppelOffre(input: AppelOffreInput) {
  return apiFetch<AppelOffre>("/appels-offres", { method: "POST", body: JSON.stringify(input) });
}

export function updateAppelOffre(id: string, input: Partial<AppelOffreInput> & { active?: boolean }) {
  return apiFetch<AppelOffre>(`/appels-offres/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function changeAppelOffreStatut(id: string, statut: Exclude<AppelOffreStatut, "VEILLE" | "GAGNE">, motifRejet?: string) {
  return apiFetch<AppelOffre>(`/appels-offres/${id}/statut`, { method: "POST", body: JSON.stringify({ statut, motifRejet }) });
}

export function gagnerAppelOffre(id: string, input: { clientId?: string; projectId?: string; tauxTva?: number }) {
  return apiFetch<{ appelOffre: AppelOffre; marche: MarchePublic }>(`/appels-offres/${id}/gagner`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const PROCEDURE_LABELS: Record<ProcedureType, string> = {
  MAPA: "MAPA",
  AOO: "Appel d'offres ouvert",
  AOR: "Appel d'offres restreint",
  DIALOGUE_COMPETITIF: "Dialogue competitif",
  NEGOCIEE: "Procedure negociee",
};

export const STATUT_LABELS: Record<AppelOffreStatut, string> = {
  VEILLE: "Veille",
  EN_PREPARATION: "En preparation",
  DEPOSE: "Depose",
  RETENU: "Retenu",
  REJETE: "Rejete",
  GAGNE: "Gagne",
  PERDU: "Perdu",
};
