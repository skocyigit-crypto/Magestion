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

export function listStockItems() {
  return apiFetch<StockItem[]>("/stock");
}

export function createStockItem(input: StockItemInput) {
  return apiFetch<StockItem>("/stock", { method: "POST", body: JSON.stringify(input) });
}

export function createMouvement(stockItemId: string, type: "ENTREE" | "SORTIE", quantite: number, motif?: string) {
  return apiFetch(`/stock/${stockItemId}/mouvements`, {
    method: "POST",
    body: JSON.stringify({ type, quantite, motif }),
  });
}
