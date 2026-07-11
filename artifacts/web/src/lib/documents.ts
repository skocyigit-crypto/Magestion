import { apiFetch, getToken } from "@/lib/api";

export type DocumentType = "CONTRAT" | "ASSURANCE" | "PERMIS" | "FACTURE" | "PLAN" | "AUTRE";

export interface DocumentItem {
  id: string;
  nom: string;
  type: DocumentType;
  entityType: string;
  entityId: string | null;
  cheminFichier: string;
  tailleOctets: number;
  mimeType: string | null;
  dateExpiration: string | null;
  active: boolean;
  createdAt: string;
}

export function listDocuments(onlyInactive = false) {
  return apiFetch<DocumentItem[]>(`/documents${onlyInactive ? "?onlyInactive=true" : ""}`);
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export async function uploadDocument(file: File, meta: { nom?: string; type?: DocumentType; dateExpiration?: string }) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  if (meta.nom) form.append("nom", meta.nom);
  if (meta.type) form.append("type", meta.type);
  if (meta.dateExpiration) form.append("dateExpiration", meta.dateExpiration);

  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erreur upload" }));
    throw new Error(body.error ?? "Erreur upload");
  }
  return res.json() as Promise<DocumentItem>;
}

// Pas de simple <a href> : la route est protegee par JWT (Authorization
// header), une navigation directe echouerait en 401 — meme pattern que le FEC.
export async function downloadDocument(id: string, nom: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors du telechargement");

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nom;
  link.click();
  URL.revokeObjectURL(link.href);
}

export interface DocumentUpdateInput {
  nom?: string;
  type?: DocumentType;
  dateExpiration?: string;
  active?: boolean;
}

export function updateDocument(id: string, input: DocumentUpdateInput) {
  return apiFetch<DocumentItem>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const TYPE_LABELS: Record<DocumentType, string> = {
  CONTRAT: "Contrat",
  ASSURANCE: "Assurance",
  PERMIS: "Permis",
  FACTURE: "Facture",
  PLAN: "Plan",
  AUTRE: "Autre",
};

export function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
