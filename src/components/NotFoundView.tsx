"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { FOCUS_RING } from "@/lib/ui";

/** Body of the global 404 page (client component: it needs the translations). */
export function NotFoundView() {
  const { t } = useTranslation();

  return (
    <PageShell mainClassName="flex flex-col items-center justify-center py-12 text-center">
      <p
        aria-hidden="true"
        className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-6xl font-bold tabular-nums text-transparent"
      >
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-white">{t("notFound.title")}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-300">{t("notFound.text")}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center rounded-lg bg-purple-700 px-4 text-sm font-medium text-white transition hover:bg-purple-600 ${FOCUS_RING}`}
        >
          {t("notFound.home")}
        </Link>
        <Link
          href="/leaderboard"
          className={`inline-flex min-h-11 items-center rounded-lg border border-gray-600 bg-gray-900 px-4 text-sm font-medium text-gray-100 transition hover:border-purple-400 hover:text-white ${FOCUS_RING}`}
        >
          {t("notFound.leaderboard")}
        </Link>
      </div>
    </PageShell>
  );
}
