import { apiFetch } from "@/lib/api";

export type ClientType = "PARTICULIER" | "PROFESSIONNEL";

export interface Client {
  id: string;
  type: ClientType;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  siret: string | null;
  tvaIntracommunautaire: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface ClientInput {
  type?: ClientType;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  tvaIntracommunautaire?: string;
  notes?: string;
}

export interface ClientUpdateInput extends Partial<ClientInput> {
  active?: boolean;
}

export interface ClientHistorique {
  projects: { id: string; nom: string; statut: string }[];
  devis: { id: string; numero: string; statut: string; montantHt: string }[];
  factures: { id: string; numero: string; statut: string; montantHt: string }[];
  caFactureHt: number;
  montantImpayeHt: number;
  nbFacturesImpayees: number;
}

export function listClients(onlyInactive = false) {
  return apiFetch<Client[]>(`/clients${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createClient(input: ClientInput) {
  return apiFetch<Client>("/clients", { method: "POST", body: JSON.stringify(input) });
}

export function getClient(id: string) {
  return apiFetch<Client>(`/clients/${id}`);
}

export function updateClient(id: string, input: ClientUpdateInput) {
  return apiFetch<Client>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getClientHistorique(id: string) {
  return apiFetch<ClientHistorique>(`/clients/${id}/historique`);
}

export const TYPE_LABELS: Record<ClientType, string> = {
  PARTICULIER: "Particulier",
  PROFESSIONNEL: "Professionnel",
};
