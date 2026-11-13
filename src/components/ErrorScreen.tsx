"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { isRetryableCode } from "@/lib/api-errors";
import type { ApiErrorCode } from "@/lib/api-errors";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export type ScreenErrorCode = ApiErrorCode | "network" | "page_not_found";

function formatWait(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  return `${Math.ceil(seconds / 60)} min`;
}

/**
 * Full-page error state with navigation: user not found, rate limits,
 * temporary GitHub failures and plain 404s. Text comes from the error `code`,
 * never from raw server messages.
 */
export function ErrorScreen({
  code,
  username,
  retryAfterSec,
  onRetry,
}: {
  code: ScreenErrorCode;
  username?: string;
  retryAfterSec?: number;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  let title = t("error.title");
  let message: string;
  if (code === "page_not_found") {
    title = t("notFound.title");
    message = t("notFound.text");
  } else if (code === "network") {
    message = t("error.network");
  } else {
    if (code === "not_found") title = t("error.code.not_found.title");
    message = t(`error.code.${code}`, { username: username ?? "" });
  }

  const canRetry =
    Boolean(onRetry) && (code === "network" || (code !== "page_not_found" && isRetryableCode(code)));
  const isMissing = code === "not_found" || code === "page_not_found" || code === "invalid_username";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Nav />
        <LanguageSelector />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div role="alert">
          <h1 className={`mb-2 text-2xl font-bold ${isMissing ? "text-white" : "text-red-400"}`}>
            {title}
          </h1>
          <p className="max-w-md text-gray-400">{message}</p>
          {retryAfterSec && retryAfterSec > 0 && code !== "not_found" ? (
            <p className="mt-2 text-sm text-gray-400">
              {t("error.retryAfter", { time: formatWait(retryAfterSec) })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
            >
              {t("error.retry")}
            </button>
          )}
          <Link
            href="/"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-500"
          >
            {code === "page_not_found" ? t("notFound.home") : t("results.newSearch")}
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-500"
          >
            {t("nav.leaderboard")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
