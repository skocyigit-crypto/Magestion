import { apiFetch } from "@/lib/api";

export type DoeStatut = "FINALISE" | "SUPERSEDED";

export interface DoeMarche {
  id: string;
  marcheId: string;
  version: number;
  statut: DoeStatut;
  documentId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DoeMarcheInput {
  marcheId: string;
  documentId?: string;
  notes?: string;
}

export function listDoeMarche(marcheId: string) {
  return apiFetch<DoeMarche[]>(`/doe-marche?marcheId=${marcheId}`);
}

export function createDoeMarche(input: DoeMarcheInput) {
  return apiFetch<DoeMarche>("/doe-marche", { method: "POST", body: JSON.stringify(input) });
}
