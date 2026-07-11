import { apiFetch, getToken } from "@/lib/api";

export interface Parametres {
  id: string;
  nom: string;
  siret: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  tvaIntracommunautaire: string | null;
  logoChemin: string | null;
  plan: string;
  status: string;
}

export interface ParametresInput {
  nom?: string;
  siret?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  tvaIntracommunautaire?: string;
}

export function getParametres() {
  return apiFetch<Parametres>("/parametres");
}

export function updateParametres(input: ParametresInput) {
  return apiFetch<Parametres>("/parametres", { method: "PATCH", body: JSON.stringify(input) });
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export async function uploadLogo(file: File): Promise<Parametres> {
  const token = getToken();
  const formData = new FormData();
  formData.append("logo", file);
  const res = await fetch(`${API_BASE}/parametres/logo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Erreur lors du televersement du logo");
  }
  return res.json();
}

// Le logo est servi par une route authentifiee (isolation tenant) : un <img
// src="..."> classique ne peut pas envoyer le header Authorization, donc on
// recupere le blob via fetch et on cree une URL locale pour l'element <img>.
export async function fetchLogoBlobUrl(): Promise<string | null> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/parametres/logo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
