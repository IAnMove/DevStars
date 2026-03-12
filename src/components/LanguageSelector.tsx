"use client";

import { useTranslation, Language } from "@/lib/i18n";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

export function LanguageSelector() {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${
            language === lang.code
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
