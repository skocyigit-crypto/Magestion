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

export function listEmployees() {
  return apiFetch<Employee[]>("/employees");
}

export function createEmployee(input: EmployeeInput) {
  return apiFetch<Employee>("/employees", { method: "POST", body: JSON.stringify(input) });
}

export function updateEmployeeStatut(id: string, statut: EmployeeStatut) {
  return apiFetch<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
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
