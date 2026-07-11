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

export function listArticles() {
  return apiFetch<Article[]>("/articles");
}

export function createArticle(input: ArticleInput) {
  return apiFetch<Article>("/articles", { method: "POST", body: JSON.stringify(input) });
}

export const CATEGORIE_LABELS: Record<ArticleCategorie, string> = {
  FOURNITURE: "Fourniture",
  MAIN_OEUVRE: "Main d'oeuvre",
  MATERIEL: "Materiel",
  SOUS_TRAITANCE: "Sous-traitance",
  DIVERS: "Divers",
};
