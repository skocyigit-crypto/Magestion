import { apiFetch } from "@/lib/api";

export type ArticleCategorie = "FOURNITURE" | "MAIN_OEUVRE" | "MATERIEL" | "SOUS_TRAITANCE" | "DIVERS";

export interface Article {
  id: string;
  code: string;
  libelle: string;
  unite: string;
  categorie: ArticleCategorie;
  prixUnitaireHt: string;
  active: boolean;
}

export interface ArticleInput {
  code: string;
  libelle: string;
  unite?: string;
  categorie?: ArticleCategorie;
  prixUnitaireHt: number;
}

export interface ArticleUpdateInput extends Partial<ArticleInput> {
  active?: boolean;
}

export function listArticles(onlyInactive = false) {
  return apiFetch<Article[]>(`/articles${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createArticle(input: ArticleInput) {
  return apiFetch<Article>("/articles", { method: "POST", body: JSON.stringify(input) });
}

export function updateArticle(id: string, input: ArticleUpdateInput) {
  return apiFetch<Article>(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const CATEGORIE_LABELS: Record<ArticleCategorie, string> = {
  FOURNITURE: "Fourniture",
  MAIN_OEUVRE: "Main d'oeuvre",
  MATERIEL: "Materiel",
  SOUS_TRAITANCE: "Sous-traitance",
  DIVERS: "Divers",
};
