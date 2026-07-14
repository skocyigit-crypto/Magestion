import { apiFetch } from "@/lib/api";

export type LotMarcheStatut = "A_ATTRIBUER" | "ATTRIBUE" | "INFRUCTUEUX" | "TERMINE";

export interface LotMarche {
  id: string;
  marcheId: string;
  numeroLot: string;
  intitule: string;
  corpsMetier: string | null;
  montantEstimeHt: string;
  montantAttribueHt: string | null;
  attributaireClientId: string | null;
  statut: LotMarcheStatut;
  dateAttribution: string | null;
  notes: string | null;
}

export interface LotMarcheInput {
  marcheId: string;
  numeroLot: string;
  intitule: string;
  corpsMetier?: string;
  montantEstimeHt: number;
  attributaireClientId?: string;
  notes?: string;
}

export function listLotsMarche(marcheId: string) {
  return apiFetch<LotMarche[]>(`/lots-marche?marcheId=${marcheId}`);
}

export function createLotMarche(input: LotMarcheInput) {
  return apiFetch<LotMarche>("/lots-marche", { method: "POST", body: JSON.stringify(input) });
}

export function updateLotMarche(id: string, input: Partial<LotMarcheInput> & { montantAttribueHt?: number }) {
  return apiFetch<LotMarche>(`/lots-marche/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function changeLotMarcheStatut(id: string, statut: Exclude<LotMarcheStatut, "A_ATTRIBUER">, attributaireClientId?: string) {
  return apiFetch<LotMarche>(`/lots-marche/${id}/statut`, { method: "POST", body: JSON.stringify({ statut, attributaireClientId }) });
}

export const LOT_STATUT_LABELS: Record<LotMarcheStatut, string> = {
  A_ATTRIBUER: "A attribuer",
  ATTRIBUE: "Attribue",
  INFRUCTUEUX: "Infructueux",
  TERMINE: "Termine",
};
