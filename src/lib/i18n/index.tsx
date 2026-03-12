"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import en from "./en.json";
import es from "./es.json";

export type Language = "en" | "es";

const dictionaries: Record<Language, Record<string, string>> = { en, es };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => dictionaries.en[key] || key,
});

const Provider = I18nContext.Provider;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem("language") as Language | null;
    if (stored && dictionaries[stored]) setLanguageState(stored);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string): string => {
    return dictionaries[language][key] || dictionaries.en[key] || key;
  };

  return <Provider value={{ language, setLanguage, t }}>{children}</Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
