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

export interface PointageUpdateInput {
  heureArrivee?: string;
  heureDepart?: string | null;
  projectId?: string;
  active?: boolean;
}

// Correction manuelle (oubli/erreur de pointage) — pas de renvoi de liste
// filtree par le backend : GET /pointage retourne toutes les lignes (actives
// et archivees) sans support d'un parametre onlyInactive, le filtrage
// "afficher les archives" se fait donc cote client sur le champ `active`.
export function updatePointage(id: string, input: PointageUpdateInput) {
  return apiFetch<Pointage>(`/pointage/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// <input type="datetime-local"> attend "YYYY-MM-DDTHH:mm" (sans secondes ni
// timezone) ; on tronque l'ISO renvoye par l'API a cette forme.
export function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}
