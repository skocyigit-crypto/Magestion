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

export function logRelance(devisId: string, type: "EMAIL" | "APPEL" | "SMS" | "AUTRE", notes?: string) {
  return apiFetch("/relances", { method: "POST", body: JSON.stringify({ devisId, type, notes }) });
}

export const PALIER_LABELS: Record<string, string> = { J7: "J+7", J14: "J+14", J30: "J+30" };
export const PALIER_COLORS: Record<string, string> = {
  J7: "text-primary",
  J14: "text-orange-400",
  J30: "text-red-400",
};
