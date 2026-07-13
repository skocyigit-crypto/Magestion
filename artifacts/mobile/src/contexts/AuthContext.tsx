import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearStoredUser,
  clearToken,
  getStoredUser,
  getToken,
  login as apiLogin,
  setStoredUser,
  setToken,
  type CurrentUser,
} from "../lib/api";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaure la session au demarrage (token deja stocke sur l'appareil) —
  // evite de redemander un login a chaque ouverture de l'app.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser();
      if (token && storedUser) setUser(storedUser);
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const { token, user: loggedInUser } = await apiLogin(email, password);
    await setToken(token);
    await setStoredUser(loggedInUser);
    setUser(loggedInUser);
  }

  async function logout() {
    await clearToken();
    await clearStoredUser();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise dans un AuthProvider");
  return ctx;
}
