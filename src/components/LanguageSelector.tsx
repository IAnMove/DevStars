"use client";

import { useTranslation } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

// `name` is the autonym of each language (never translated)
const LANGUAGES: { code: Language; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
];

export function LanguageSelector() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5"
    >
      {LANGUAGES.map((lang) => {
        const active = language === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            lang={lang.code}
            aria-pressed={active}
            onClick={() => setLanguage(lang.code)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-semibold transition ${
              active ? "bg-purple-700 text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            <span aria-hidden="true">{lang.label}</span>
            <span className="sr-only">{lang.name}</span>
          </button>
        );
      })}
    </div>
  );
}
