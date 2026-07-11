import { apiFetch } from "@/lib/api";

export type UserRole = "SUPER_ADMIN" | "COMMERCIAL" | "TERRAIN" | "COMPTABILITE";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super administrateur",
  COMMERCIAL: "Commercial",
  TERRAIN: "Terrain",
  COMPTABILITE: "Comptabilite",
};

export interface AppUser {
  id: string;
  email: string;
  nom: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface UserInput {
  email: string;
  password: string;
  nom: string;
  role: UserRole;
}

export interface UserUpdateInput {
  nom?: string;
  role?: UserRole;
  active?: boolean;
  password?: string;
}

export function listUsers() {
  return apiFetch<AppUser[]>("/users");
}

export function createUser(input: UserInput) {
  return apiFetch<AppUser>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UserUpdateInput) {
  return apiFetch<AppUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
