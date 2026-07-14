import { apiFetch } from "@/lib/api";

export type CategorieCarbone = "TRANSPORT" | "MATERIAUX" | "ENERGIE" | "DECHETS" | "AUTRE";

export interface BilanCarbone {
  id: string;
  projectId: string;
  categorie: CategorieCarbone;
  materiauIniesId: string | null;
  poste: string;
  quantite: string;
  unite: string;
  facteurEmissionKgCo2: string;
  emissionsKgCo2: string;
  dateOperation: string;
  notes: string | null;
  active: boolean;
}

export interface BilanCarboneInput {
  projectId: string;
  categorie: CategorieCarbone;
  materiauIniesId?: string;
  poste: string;
  quantite: number;
  unite: string;
  facteurEmissionKgCo2: number;
  dateOperation: string;
  notes?: string;
}

// Materiau de reference (base INIES/ADEME) : accelere la saisie d'une ligne
// de bilan carbone sans imposer de valeur — la saisie 100% libre reste
// possible (voir CATEGORIE_LABELS/formulaire, materiauIniesId optionnel).
export interface MateriauInies {
  id: string;
  codeInies: string | null;
  designation: string;
  categorie: string;
  sousCategorie: string | null;
  uniteFonctionnelle: string;
  emissionCo2Kg: string;
  source: string;
  dureeVieAns: number | null;
  densiteKgM3: string | null;
  description: string | null;
  active: boolean;
}

export const MATERIAU_CATEGORIE_LABELS: Record<string, string> = {
  gros_oeuvre: "Gros oeuvre",
  isolation: "Isolation",
  menuiserie: "Menuiserie",
  second_oeuvre: "Second oeuvre",
  couverture: "Couverture",
  plomberie: "Plomberie",
  electricite: "Electricite",
};

export function listMateriauxInies() {
  return apiFetch<MateriauInies[]>("/bilan-carbone/materiaux-inies");
}

export function listBilanCarbone(projectId?: string) {
  return apiFetch<BilanCarbone[]>(`/bilan-carbone${projectId ? `?projectId=${projectId}` : ""}`);
}

export function createBilanCarbone(input: BilanCarboneInput) {
  return apiFetch<BilanCarbone>("/bilan-carbone", { method: "POST", body: JSON.stringify(input) });
}

export function updateBilanCarbone(id: string, input: Partial<BilanCarboneInput> & { active?: boolean }) {
  return apiFetch<BilanCarbone>(`/bilan-carbone/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const CATEGORIE_LABELS: Record<CategorieCarbone, string> = {
  TRANSPORT: "Transport",
  MATERIAUX: "Materiaux",
  ENERGIE: "Energie",
  DECHETS: "Dechets",
  AUTRE: "Autre",
};

// Facteurs indicatifs (ordre de grandeur ADEME Base Carbone) pour accelerer
// la saisie — l'utilisateur peut toujours les ajuster manuellement, aucune
// valeur legale certifiee n'est garantie ici.
export const PRESETS_EMISSION: { label: string; categorie: CategorieCarbone; poste: string; unite: string; facteur: number }[] = [
  { label: "Transport camion (par km)", categorie: "TRANSPORT", poste: "Transport routier", unite: "km", facteur: 0.9 },
  { label: "Beton (par tonne)", categorie: "MATERIAUX", poste: "Beton", unite: "t", facteur: 100 },
  { label: "Acier/metaux (par tonne)", categorie: "MATERIAUX", poste: "Acier", unite: "t", facteur: 1850 },
  { label: "Bois (par tonne)", categorie: "MATERIAUX", poste: "Bois", unite: "t", facteur: 30 },
  { label: "Electricite (par kWh)", categorie: "ENERGIE", poste: "Electricite chantier", unite: "kWh", facteur: 0.06 },
  { label: "Gasoil engins (par litre)", categorie: "ENERGIE", poste: "Carburant engins", unite: "L", facteur: 2.68 },
  { label: "Dechets enfouis (par tonne)", categorie: "DECHETS", poste: "Enfouissement", unite: "t", facteur: 20 },
];
