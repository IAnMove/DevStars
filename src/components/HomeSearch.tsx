"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isValidUsername } from "@/lib/username";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export function HomeSearch() {
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
    if (!isValidUsername(trimmed)) {
      setError(t("search.error.invalid"));
      return;
    }
    setError("");
    router.push(`/user/${trimmed}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute left-4 top-4">
        <Nav />
      </div>
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-xl text-center">
        <h1 className="mb-2 text-5xl font-bold tracking-tight">
          <span className="text-white">GitHub</span>{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Stars
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

        <p className="mx-auto mt-12 max-w-lg text-xs leading-relaxed text-gray-400">
          {t("app.disclaimer")}
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </main>
  );
}
