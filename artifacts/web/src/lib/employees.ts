import { apiFetch } from "@/lib/api";

export type EmployeeRole =
  | "CHEF_CHANTIER" | "CONDUCTEUR_TRAVAUX" | "MACON" | "ELECTRICIEN" | "PLOMBIER"
  | "CHARPENTIER" | "COUVREUR" | "PEINTRE" | "CARRELEUR" | "MANOEUVRE" | "AUTRE";
export type EmployeeStatut = "SUR_CHANTIER" | "EN_ROUTE" | "ABSENT" | "INDISPONIBLE" | "CONGE";

export interface Employee {
  id: string;
  nom: string;
  prenom: string;
  role: EmployeeRole;
  telephone: string | null;
  email: string | null;
  tauxHoraire: string;
  couleur: string;
  statut: EmployeeStatut;
  anonymise: boolean;
  active: boolean;
}

export interface EmployeeInput {
  nom: string;
  prenom: string;
  role?: EmployeeRole;
  telephone?: string;
  email?: string;
  tauxHoraire?: number;
}

export function listEmployees(onlyInactive = false) {
  return apiFetch<Employee[]>(`/employees${onlyInactive ? "?onlyInactive=true" : ""}`);
}

export function getEmployee(id: string) {
  return apiFetch<Employee>(`/employees/${id}`);
}

export function createEmployee(input: EmployeeInput) {
  return apiFetch<Employee>("/employees", { method: "POST", body: JSON.stringify(input) });
}

export function updateEmployeeStatut(id: string, statut: EmployeeStatut) {
  return apiFetch<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
}

export interface EmployeeUpdateInput extends Partial<EmployeeInput> {
  active?: boolean;
}

export function updateEmployee(id: string, input: EmployeeUpdateInput) {
  return apiFetch<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  CHEF_CHANTIER: "Chef de chantier",
  CONDUCTEUR_TRAVAUX: "Conducteur de travaux",
  MACON: "Macon",
  ELECTRICIEN: "Electricien",
  PLOMBIER: "Plombier",
  CHARPENTIER: "Charpentier",
  COUVREUR: "Couvreur",
  PEINTRE: "Peintre",
  CARRELEUR: "Carreleur",
  MANOEUVRE: "Manoeuvre",
  AUTRE: "Autre",
};

export const STATUT_LABELS: Record<EmployeeStatut, string> = {
  SUR_CHANTIER: "Sur chantier",
  EN_ROUTE: "En route",
  ABSENT: "Absent",
  INDISPONIBLE: "Indisponible",
  CONGE: "Conge",
};

export type HabilitationType = "CARTE_BTP" | "VISITE_MEDICALE" | "CACES" | "TITRE_SEJOUR" | "HABILITATION_ELECTRIQUE" | "AUTRE";

export interface Habilitation {
  id: string;
  employeeId: string;
  type: HabilitationType;
  libelle: string | null;
  dateValidite: string;
  active: boolean;
}

export interface HabilitationInput {
  type: HabilitationType;
  libelle?: string;
  dateValidite: string;
}

export interface HabilitationEcheance {
  id: string;
  employeeId: string;
  employeeNom: string;
  type: HabilitationType;
  libelle: string | null;
  dateValidite: string;
  joursRestants: number;
  expiree: boolean;
}

export function listEmployeeHabilitations(employeeId: string) {
  return apiFetch<Habilitation[]>(`/employees/${employeeId}/habilitations`);
}

export function createEmployeeHabilitation(employeeId: string, input: HabilitationInput) {
  return apiFetch<Habilitation>(`/employees/${employeeId}/habilitations`, { method: "POST", body: JSON.stringify(input) });
}

export function archiverHabilitation(id: string) {
  return apiFetch<Habilitation>(`/employees/habilitations/${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
}

export function listEcheancesRh() {
  return apiFetch<HabilitationEcheance[]>("/employees/echeances");
}

export const HABILITATION_TYPE_LABELS: Record<HabilitationType, string> = {
  CARTE_BTP: "Carte BTP",
  VISITE_MEDICALE: "Visite medicale",
  CACES: "CACES",
  TITRE_SEJOUR: "Titre de sejour",
  HABILITATION_ELECTRIQUE: "Habilitation electrique",
  AUTRE: "Autre",
};
