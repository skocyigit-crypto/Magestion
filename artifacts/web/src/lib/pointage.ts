import { apiFetch } from "@/lib/api";

export interface Pointage {
  id: string;
  employeeId: string;
  projectId: string | null;
  dateJour: string;
  heureArrivee: string;
  heureDepart: string | null;
  active: boolean;
}

export function listPointage() {
  return apiFetch<Pointage[]>("/pointage");
}

export function pointerArrivee(employeeId: string, projectId?: string) {
  return apiFetch<Pointage>("/pointage/arrivee", { method: "POST", body: JSON.stringify({ employeeId, projectId }) });
}

export function pointerDepart(id: string) {
  return apiFetch<Pointage>(`/pointage/${id}/depart`, { method: "POST" });
}
