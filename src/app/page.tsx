"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Home() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError(t("search.error.empty"));
      return;
    }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed)) {
      setError(t("search.error.invalid"));
      return;
    }
    setError("");
    router.push(`/user/${trimmed}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-xl text-center">
        <h1 className="mb-2 text-5xl font-bold tracking-tight">
          <span className="text-white">GitHub</span>{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Dev Evaluator
          </span>
        </h1>
        <p className="mb-8 text-lg text-gray-400">
          {t("app.subtitle")}
          <br />
          {t("app.subtitle2")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder={t("search.placeholder")}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white transition hover:from-purple-600 hover:to-pink-600 active:scale-95"
          >
            {t("search.button")}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <p className="mt-12 text-xs text-gray-600">
          {t("app.disclaimer")}
        </p>
      </div>
    </main>
  );
}
