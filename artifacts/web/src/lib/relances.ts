import { apiFetch } from "@/lib/api";

export interface RelanceAFaire {
  devisId: string;
  numero: string;
  client: string;
  objet: string;
  montantHt: string;
  dateEnvoi: string | null;
  joursDepuisEnvoi: number;
  palier: "J7" | "J14" | "J30";
  nbRelancesEffectuees: number;
}

export function listRelancesAFaire() {
  return apiFetch<RelanceAFaire[]>("/relances/a-faire");
}

export interface LogRelanceResult {
  id: string;
  devisId: string;
  type: string;
  emailSent?: boolean;
  emailError?: string;
}

export function logRelance(devisId: string, type: "EMAIL" | "APPEL" | "SMS" | "AUTRE", notes?: string) {
  return apiFetch<LogRelanceResult>("/relances", { method: "POST", body: JSON.stringify({ devisId, type, notes }) });
}

export const PALIER_LABELS: Record<string, string> = { J7: "J+7", J14: "J+14", J30: "J+30" };
export const PALIER_COLORS: Record<string, string> = {
  J7: "text-primary",
  J14: "text-orange-400",
  J30: "text-red-400",
};

export interface RelanceFactureAFaire {
  factureId: string;
  numero: string;
  client: string;
  objet: string;
  montantHt: string;
  tauxTva: string;
  dateEcheance: string;
  joursDeRetard: number;
  niveau: "RAPPEL" | "RELANCE_FERME" | "MISE_EN_DEMEURE";
  nbRelancesEffectuees: number;
}

export function listRelancesFacturesAFaire() {
  return apiFetch<RelanceFactureAFaire[]>("/relances/factures-a-faire");
}

export function logRelanceFacture(factureId: string, type: "EMAIL" | "APPEL" | "SMS" | "AUTRE", notes?: string) {
  return apiFetch<LogRelanceResult>("/relances/facture", { method: "POST", body: JSON.stringify({ factureId, type, notes }) });
}

export const NIVEAU_LABELS: Record<string, string> = {
  RAPPEL: "Rappel",
  RELANCE_FERME: "Relance ferme",
  MISE_EN_DEMEURE: "Mise en demeure",
};
export const NIVEAU_COLORS: Record<string, string> = {
  RAPPEL: "text-primary",
  RELANCE_FERME: "text-orange-400",
  MISE_EN_DEMEURE: "text-red-400",
};
