import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken } from "./api";

interface AuthState {
  status: "loading" | "authed" | "guest";
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<{ devOnlyVerifyToken?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  useEffect(() => {
    api
      .post<{ accessToken: string }>("/auth/refresh")
      .then((res) => {
        setAccessToken(res.accessToken);
        setStatus("authed");
      })
      .catch(() => setStatus("guest"));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string }>("/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setStatus("authed");
  }

  async function register(email: string, password: string) {
    return api.post<{ devOnlyVerifyToken?: string }>("/auth/register", { email, password });
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setStatus("guest");
  }

  return <AuthContext.Provider value={{ status, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
