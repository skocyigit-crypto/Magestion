import { apiFetch } from "@/lib/api";

export interface IndiceBt {
  id: string;
  code: string;
  libelle: string;
  periode: string;
  valeur: string;
  datePublication: string | null;
  source: string | null;
  notes: string | null;
  createdAt: string;
}

export interface IndiceBtInput {
  code: string;
  libelle: string;
  periode: string;
  valeur: number;
  datePublication?: string;
  source?: string;
  notes?: string;
}

export function listIndicesBt(code?: string) {
  return apiFetch<IndiceBt[]>(`/indices-bt${code ? `?code=${code}` : ""}`);
}

export function createIndiceBt(input: IndiceBtInput) {
  return apiFetch<IndiceBt>("/indices-bt", { method: "POST", body: JSON.stringify(input) });
}
