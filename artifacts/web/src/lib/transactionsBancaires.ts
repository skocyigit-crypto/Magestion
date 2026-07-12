import { apiFetch, getToken } from "@/lib/api";

export type RapprochementStatut = "NON_RAPPROCHE" | "RAPPROCHE_AUTO" | "RAPPROCHE_MANUEL" | "IGNORE";

export interface TransactionBancaire {
  id: string;
  dateOperation: string;
  libelle: string;
  montant: string;
  reference: string | null;
  importBatchId: string;
  rapprochementStatut: RapprochementStatut;
  factureId: string | null;
  depenseId: string | null;
  createdAt: string;
}

export function listTransactionsBancaires() {
  return apiFetch<TransactionBancaire[]>("/transactions-bancaires");
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export interface ImportResult {
  importBatchId: string;
  total: number;
  rapprochees: number;
}

export async function importReleveBancaire(file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/transactions-bancaires/import`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erreur import" }));
    throw new Error(body.error ?? "Erreur import");
  }
  return res.json() as Promise<ImportResult>;
}

export function rapprocherTransaction(id: string, input: { factureId?: string; depenseId?: string; ignore?: boolean }) {
  return apiFetch<TransactionBancaire>(`/transactions-bancaires/${id}/rapprocher`, { method: "POST", body: JSON.stringify(input) });
}

export function annulerRapprochement(id: string) {
  return apiFetch<TransactionBancaire>(`/transactions-bancaires/${id}/annuler-rapprochement`, { method: "POST" });
}

export const RAPPROCHEMENT_STATUT_LABELS: Record<RapprochementStatut, string> = {
  NON_RAPPROCHE: "Non rapprochee",
  RAPPROCHE_AUTO: "Rapprochee (auto)",
  RAPPROCHE_MANUEL: "Rapprochee (manuel)",
  IGNORE: "Ignoree",
};
