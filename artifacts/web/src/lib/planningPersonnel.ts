import { apiFetch } from "@/lib/api";

export type AffectationType = "CHANTIER" | "CONGE" | "MALADIE" | "FORMATION" | "DEPLACEMENT" | "REPOS" | "BUREAU";

export interface Affectation {
  id: string;
  employeeId: string;
  projectId: string | null;
  date: string;
  type: AffectationType;
  chefEquipe: boolean;
  active: boolean;
}

export interface AffectationInput {
  employeeId: string;
  projectId?: string;
  date: string;
  type?: AffectationType;
  chefEquipe?: boolean;
}

export function listAffectations(debut: string, fin: string) {
  return apiFetch<Affectation[]>(`/planning-personnel?debut=${debut}&fin=${fin}`);
}

export function createAffectation(input: AffectationInput) {
  return apiFetch<Affectation>("/planning-personnel", { method: "POST", body: JSON.stringify(input) });
}

export function retirerAffectation(id: string) {
  return apiFetch<Affectation>(`/planning-personnel/${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
}

export function updateAffectation(id: string, input: Partial<AffectationInput>) {
  return apiFetch<Affectation>(`/planning-personnel/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const TYPE_LABELS: Record<AffectationType, string> = {
  CHANTIER: "Chantier",
  CONGE: "Conge",
  MALADIE: "Maladie",
  FORMATION: "Formation",
  DEPLACEMENT: "Deplacement",
  REPOS: "Repos",
  BUREAU: "Bureau",
};

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // lundi = debut de semaine
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
