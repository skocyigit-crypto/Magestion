import { apiFetch } from "@/lib/api";

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
