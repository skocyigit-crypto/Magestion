import { apiFetch } from "@/lib/api";

export interface BudgetPoste {
  id: string;
  compteNum: string;
  exercice: number;
  montantBudgeteHt: string;
  notes: string | null;
}

export interface BudgetPosteInput {
  compteNum: string;
  exercice: number;
  montantBudgeteHt: number;
  notes?: string;
}

export interface BudgetRealise {
  compteNum: string;
  compteLib: string;
  budgetId: string | null;
  montantBudgeteHt: number;
  montantRealiseHt: number;
  ecart: number;
}

export function listBudgetsPostes(exercice?: number) {
  return apiFetch<BudgetPoste[]>(`/budgets-postes${exercice ? `?exercice=${exercice}` : ""}`);
}

export function createBudgetPoste(input: BudgetPosteInput) {
  return apiFetch<BudgetPoste>("/budgets-postes", { method: "POST", body: JSON.stringify(input) });
}

export function updateBudgetPoste(id: string, input: Partial<Pick<BudgetPosteInput, "montantBudgeteHt" | "notes">>) {
  return apiFetch<BudgetPoste>(`/budgets-postes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function listBudgetsRealise(exercice?: number) {
  return apiFetch<BudgetRealise[]>(`/budgets-postes/realise${exercice ? `?exercice=${exercice}` : ""}`);
}
