import { apiFetch } from "@/lib/api";

export type PlanKey = "STARTER" | "PME" | "ENTREPRISE";

export interface BillingPlan {
  key: PlanKey;
  nom: string;
  prixMensuelEur: number;
  features: string[];
  disponible: boolean;
}

export interface BillingStatus {
  plan: "TRIAL" | PlanKey;
  status: "ACTIF" | "SUSPENDU" | "ARCHIVE";
  trialEndsAt: string | null;
  joursRestantsEssai: number | null;
  essaiExpire: boolean;
  abonneStripe: boolean;
  simulation: boolean;
}

export function listBillingPlans() {
  return apiFetch<BillingPlan[]>("/billing/plans");
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/billing/status");
}

export function startCheckout(planKey: PlanKey) {
  return apiFetch<{ simulation: boolean; url: string | null; plan?: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planKey }),
  });
}

export function openBillingPortal() {
  return apiFetch<{ simulation: boolean; url: string | null }>("/billing/portal", { method: "POST" });
}

export const PLAN_LABELS: Record<"TRIAL" | PlanKey, string> = {
  TRIAL: "Essai",
  STARTER: "Starter",
  PME: "PME",
  ENTREPRISE: "Entreprise",
};
