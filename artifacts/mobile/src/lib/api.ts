import AsyncStorage from "@react-native-async-storage/async-storage";

// Backend deploye sur Cloud Run (voir Dockerfile a la racine du monorepo).
// Contrairement au web (proxy Vite relatif), l'app mobile n'a pas de proxy
// dev — elle appelle toujours une URL absolue.
const API_BASE = "https://magestion-557658661240.europe-west1.run.app/api";

const TOKEN_KEY = "magestion_mobile_token";
const USER_KEY = "magestion_mobile_user";

export interface CurrentUser {
  id: string;
  email: string;
  nom: string;
  role: "SUPER_ADMIN" | "COMMERCIAL" | "TERRAIN" | "COMPTABILITE";
  licenceId: string | null;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<CurrentUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as CurrentUser) : null;
}

export async function setStoredUser(user: CurrentUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
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

export function login(email: string, password: string) {
  return apiFetch<{ token: string; user: CurrentUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
