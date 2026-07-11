import { apiFetch } from "@/lib/api";

export type VehicleType = "CAMION" | "CAMIONNETTE" | "FOURGON" | "VOITURE" | "ENGIN_CHANTIER" | "AUTRE";
export type VehicleCarburant = "DIESEL" | "ESSENCE" | "ELECTRIQUE" | "GPL" | "HYBRIDE";
export type VehicleStatut = "DISPONIBLE" | "EN_MISSION" | "EN_MAINTENANCE" | "HORS_SERVICE";

export interface Vehicle {
  id: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  type: VehicleType;
  carburant: VehicleCarburant;
  statut: VehicleStatut;
  kilometrage: number;
  dateAssuranceValidite: string | null;
  dateControleTechniqueValidite: string | null;
  active: boolean;
}

export interface VehicleInput {
  immatriculation: string;
  marque?: string;
  modele?: string;
  type?: VehicleType;
  carburant?: VehicleCarburant;
  kilometrage?: number;
  dateAssuranceValidite?: string;
  dateControleTechniqueValidite?: string;
}

export interface VehicleUpdateInput extends Partial<VehicleInput> {
  statut?: VehicleStatut;
  active?: boolean;
}

export function listVehicles(onlyInactive = false) {
  return apiFetch<Vehicle[]>(`/vehicles${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function createVehicle(input: VehicleInput) {
  return apiFetch<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(input) });
}

export function updateVehicleStatut(id: string, statut: VehicleStatut) {
  return apiFetch<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
}

export function updateVehicle(id: string, input: VehicleUpdateInput) {
  return apiFetch<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const CARBURANT_LABELS: Record<VehicleCarburant, string> = {
  DIESEL: "Diesel",
  ESSENCE: "Essence",
  ELECTRIQUE: "Electrique",
  GPL: "GPL",
  HYBRIDE: "Hybride",
};

export const TYPE_LABELS: Record<VehicleType, string> = {
  CAMION: "Camion",
  CAMIONNETTE: "Camionnette",
  FOURGON: "Fourgon",
  VOITURE: "Voiture",
  ENGIN_CHANTIER: "Engin de chantier",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<VehicleStatut, string> = {
  DISPONIBLE: "Disponible",
  EN_MISSION: "En mission",
  EN_MAINTENANCE: "En maintenance",
  HORS_SERVICE: "Hors service",
};
