import { useState, useEffect, createContext, useContext } from "react";
import { type StoredUser, getStoredUser, getStoredToken, setStoredAuth, clearStoredAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export interface AuthContextType {
  user: StoredUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  setUser: (user: StoredUser) => void;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  whatsapp?: string;
  role: "customer" | "worker" | "both";
  location?: string;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  setUser: () => {},
});

export function useAuthState(): AuthContextType {
  const [user, setUserState] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      setUserState(storedUser);
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post("/auth/login", { email, password });
    setStoredAuth(data.user, data.token);
    setUserState(data.user);
    setToken(data.token);
  };

  const register = async (formData: RegisterData) => {
    const data = await api.post("/auth/register", formData);
    setStoredAuth(data.user, data.token);
    setUserState(data.user);
    setToken(data.token);
  };

  const logout = () => {
    clearStoredAuth();
    setUserState(null);
    setToken(null);
  };

  const setUser = (u: StoredUser) => {
    setUserState(u);
    localStorage.setItem("blinkbuy_user", JSON.stringify(u));
  };

  return { user, token, isLoading, login, register, logout, setUser };
}

export function useAuth() {
  return useContext(AuthContext);
}
