const USER_KEY = "blinkbuy_user";
const TOKEN_KEY = "blinkbuy_token";
const LANG_KEY = "blinkbuy_lang";
const THEME_KEY = "blinkbuy_theme";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  role: "customer" | "worker" | "both" | "admin";
  location?: string;
  profilePhoto?: string;
  bio?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isTrusted?: boolean;
  rating?: number;
  reviewCount?: number;
  jobsCompleted?: number;
  profileStrength?: number;
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuth(user: StoredUser, token: string) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isAdmin(user: StoredUser | null): boolean {
  return user?.role === "admin" || user?.email === "otechy8@gmail.com";
}

export function getLanguage(): "en" | "ny" {
  return (localStorage.getItem(LANG_KEY) as "en" | "ny") || "en";
}

export function setLanguage(lang: "en" | "ny") {
  localStorage.setItem(LANG_KEY, lang);
}

export function getTheme(): "light" | "dark" {
  return (localStorage.getItem(THEME_KEY) as "light" | "dark") || "light";
}

export function setTheme(theme: "light" | "dark") {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function formatMK(amount: number | null | undefined): string {
  if (!amount) return "Negotiable";
  return `MK ${amount.toLocaleString()}`;
}

export const TRANSLATIONS: Record<string, Record<"en" | "ny", string>> = {
  "Home": { en: "Home", ny: "Kwathu" },
  "Find Work": { en: "Find Work", ny: "Peza Ntchito" },
  "Marketplace": { en: "Marketplace", ny: "Msika" },
  "Messages": { en: "Messages", ny: "Mauthenga" },
  "Login": { en: "Login", ny: "Lowani" },
  "Register": { en: "Register", ny: "Lembani" },
  "Search services...": { en: "Search services...", ny: "Sakani ntchito..." },
  "Get Help Now": { en: "Get Help Now", ny: "Thandizani Tsopano" },
  "Book": { en: "Book", ny: "Bookani" },
  "Apply": { en: "Apply", ny: "Yankani" },
  "Price": { en: "Price", ny: "Ngongole" },
  "Location": { en: "Location", ny: "Malo" },
  "Hello": { en: "Hello", ny: "Moni" },
  "Available": { en: "Available", ny: "Adyera" },
  "Offline": { en: "Offline", ny: "Palibe Intaneti" },
};

export function t(key: string, lang: "en" | "ny" = "en"): string {
  return TRANSLATIONS[key]?.[lang] || key;
}
