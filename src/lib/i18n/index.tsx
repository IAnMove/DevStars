"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import en from "./en.json";
import es from "./es.json";

export type Language = "en" | "es";

const dictionaries: Record<Language, Record<string, string>> = { en, es };

const DEFAULT_LANGUAGE: Language = "en";
const STORAGE_KEY = "language";

export type TranslationVars = Record<string, string | number>;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translates `key`; `{name}` placeholders are replaced with `vars.name`. */
  t: (key: string, vars?: TranslationVars) => string;
}

function interpolate(text: string, vars?: TranslationVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

function isLanguage(value: string | null): value is Language {
  return value !== null && Object.prototype.hasOwnProperty.call(dictionaries, value);
}

// --- Tiny external store over localStorage -------------------------------

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Also react to language changes made in other tabs
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

function writeLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage unavailable (private mode, quota): ignore
  }
  listeners.forEach((listener) => listener());
}

// -------------------------------------------------------------------------

const I18nContext = createContext<I18nContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key, vars) => interpolate(dictionaries.en[key] || key, vars),
});

const Provider = I18nContext.Provider;

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep <html lang> in sync with the language actually shown
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    writeLanguage(lang);
  };

  const t = (key: string, vars?: TranslationVars): string => {
    return interpolate(dictionaries[language][key] || dictionaries.en[key] || key, vars);
  };

  return <Provider value={{ language, setLanguage, t }}>{children}</Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
