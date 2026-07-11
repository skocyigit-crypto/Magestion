import { apiFetch } from "@/lib/api";

export interface StockItem {
  id: string;
  nom: string;
  categorie: string | null;
  unite: string;
  quantiteActuelle: string;
  seuilAlerte: string;
  prixUnitaireHt: string;
  enAlerte: boolean;
  active: boolean;
}

export interface StockItemInput {
  nom: string;
  categorie?: string;
  unite?: string;
  seuilAlerte?: number;
  prixUnitaireHt?: number;
}

export interface StockItemUpdateInput extends Partial<StockItemInput> {
  active?: boolean;
}

export function listStockItems(onlyInactive = false) {
  return apiFetch<StockItem[]>(`/stock${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createStockItem(input: StockItemInput) {
  return apiFetch<StockItem>("/stock", { method: "POST", body: JSON.stringify(input) });
}

export function updateStockItem(id: string, input: StockItemUpdateInput) {
  return apiFetch<StockItem>(`/stock/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function createMouvement(stockItemId: string, type: "ENTREE" | "SORTIE", quantite: number, motif?: string) {
  return apiFetch(`/stock/${stockItemId}/mouvements`, {
    method: "POST",
    body: JSON.stringify({ type, quantite, motif }),
  });
}
