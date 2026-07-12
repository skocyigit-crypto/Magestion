const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;
const TOKEN_KEY = "magestion_token";
const USER_KEY = "magestion_user";

export interface CurrentUser {
  id: string;
  email: string;
  nom: string;
  role: "SUPER_ADMIN" | "COMMERCIAL" | "TERRAIN" | "COMPTABILITE";
  licenceId: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): CurrentUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as CurrentUser) : null;
}

export function setUser(user: CurrentUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Erreur reseau");
  }

  return res.json() as Promise<T>;
}

export function fetchCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

// Telechargement direct (binaire, pas de JSON) : fetch manuel + Blob.
export async function downloadFile(path: string, fallbackFilename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Erreur lors du telechargement");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function login(email: string, password: string) {
  return apiFetch<{ token: string; user: CurrentUser }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
}

export function register(entreprise: string, nom: string, email: string, password: string) {
  return apiFetch<{ token: string; user: CurrentUser }>(
    "/auth/register",
    { method: "POST", body: JSON.stringify({ entreprise, nom, email, password }) },
  );
}
