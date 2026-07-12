import { apiFetch } from "@/lib/api";

export type LicencePlan = "TRIAL" | "STARTER" | "PME" | "ENTREPRISE";
export type LicenceStatus = "ACTIF" | "SUSPENDU" | "ARCHIVE";

export interface LicenceSummary {
  id: string;
  nom: string;
  plan: LicencePlan;
  status: LicenceStatus;
  trialEndsAt: string | null;
  stripeSubscriptionId: string | null;
  nbUtilisateurs: number;
  createdAt: string;
}

export interface LicenceDetail {
  licence: LicenceSummary;
  users: { id: string; email: string; nom: string; role: string; active: boolean }[];
}

export interface PlatformStats {
  totalLicences: number;
  parPlan: Record<LicencePlan, number>;
  actives: number;
  suspendues: number;
}

export function listLicences() {
  return apiFetch<LicenceSummary[]>("/super-admin/licences");
}

export function getPlatformStats() {
  return apiFetch<PlatformStats>("/super-admin/stats");
}

export function getLicenceDetail(id: string) {
  return apiFetch<LicenceDetail>(`/super-admin/licences/${id}`);
}

export function updateLicence(id: string, input: { status?: LicenceStatus; plan?: LicencePlan }) {
  return apiFetch<LicenceSummary>(`/super-admin/licences/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const PLAN_LABELS: Record<LicencePlan, string> = {
  TRIAL: "Essai",
  STARTER: "Starter",
  PME: "PME",
  ENTREPRISE: "Entreprise",
};

export const STATUS_LABELS: Record<LicenceStatus, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  ARCHIVE: "Archive",
};
