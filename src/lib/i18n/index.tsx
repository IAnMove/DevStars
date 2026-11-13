"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import en from "./en.json";
import es from "./es.json";

export type Language = "en" | "es";

const dictionaries: Record<Language, Record<string, string>> = { en, es };

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

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key, vars) => interpolate(dictionaries.en[key] || key, vars),
});

const Provider = I18nContext.Provider;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem("language") as Language | null;
    if (stored && dictionaries[stored]) setLanguageState(stored);
  }, []);

  // Keep <html lang> in sync with the language actually shown
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string, vars?: TranslationVars): string => {
    return interpolate(dictionaries[language][key] || dictionaries.en[key] || key, vars);
  };

  return <Provider value={{ language, setLanguage, t }}>{children}</Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
