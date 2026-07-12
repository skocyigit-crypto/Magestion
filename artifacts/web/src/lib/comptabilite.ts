import { apiFetch, getToken } from "@/lib/api";

export interface JournalEntry {
  id: string;
  journalCode: string;
  ecritureNum: number;
  ecritureDate: string;
  compteNum: string;
  compteLib: string;
  pieceRef: string;
  pieceDate: string;
  ecritureLib: string;
  debit: string;
  credit: string;
  ecritureLet: string | null;
  dateLet: string | null;
  sourceType: string;
  sourceId: string;
}

export interface BalanceLigne {
  compteNum: string;
  compteLib: string;
  totalDebit: number;
  totalCredit: number;
  solde: number;
  sens: "DEBITEUR" | "CREDITEUR";
}

export interface PlanComptableLigne {
  compteNum: string;
  libelle: string;
  active: boolean;
}

export function listJournal() {
  return apiFetch<JournalEntry[]>("/comptabilite/journal");
}

export function listBalance(exercice?: number) {
  return apiFetch<BalanceLigne[]>(`/comptabilite/balance${exercice ? `?exercice=${exercice}` : ""}`);
}

export function listPlanComptable() {
  return apiFetch<PlanComptableLigne[]>("/comptabilite/plan-comptable");
}

export function listEcrituresNonLettrees(compteNum: string) {
  return apiFetch<JournalEntry[]>(`/comptabilite/lettrage/${compteNum}`);
}

export function lettrer(entryIds: string[]) {
  return apiFetch<{ code: string; entryIds: string[] }>("/comptabilite/lettrage", { method: "POST", body: JSON.stringify({ entryIds }) });
}

export function annulerLettrage(code: string) {
  return apiFetch<{ ok: true }>(`/comptabilite/lettrage/${code}/annuler`, { method: "POST" });
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

// Telechargement direct (pas de JSON) : fetch manuel + Blob, pas via apiFetch.
export async function downloadFec(exercice?: number) {
  const token = getToken();
  const url = `${API_BASE}/comptabilite/fec${exercice ? `?exercice=${exercice}` : ""}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Erreur lors du telechargement du FEC");

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? "FEC.txt";

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
