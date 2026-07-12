import { apiFetch } from "@/lib/api";

export type RgpdEntityType = "EMPLOYEE" | "PROSPECT";
export type RgpdAction = "EXPORT" | "ANONYMISATION" | "CONSENTEMENT";

export interface JournalRgpdEntry {
  id: string;
  action: RgpdAction;
  entityType: RgpdEntityType;
  entityId: string;
  effectuePar: string | null;
  detail: string | null;
  createdAt: string;
}

export function listJournalRgpd() {
  return apiFetch<JournalRgpdEntry[]>("/rgpd/journal");
}

export function exporterDonnees(entityType: RgpdEntityType, entityId: string) {
  return apiFetch<unknown>(`/rgpd/export/${entityType}/${entityId}`);
}

export async function anonymiser(entityType: RgpdEntityType, entityId: string) {
  await apiFetch<{ ok: true }>(`/rgpd/anonymiser/${entityType}/${entityId}`, { method: "POST" });
}

export const RGPD_ACTION_LABELS: Record<RgpdAction, string> = {
  EXPORT: "Export",
  ANONYMISATION: "Anonymisation",
  CONSENTEMENT: "Consentement",
};
