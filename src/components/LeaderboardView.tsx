"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { getScoreColor } from "@/lib/gamification";
import { formatDate, localeFor, sizedAvatarUrl } from "@/lib/format";
import {
  LEADERBOARD_MAX_ROWS,
  LEADERBOARD_PAGE_SIZE,
  leaderboardPageCount,
  leaderboardPageHref,
  leaderboardProfileHref,
} from "@/lib/leaderboard-pages";
import { FOCUS_RING } from "@/lib/ui";

// Row as returned by GET /api/leaderboard (badges/categories are JSON strings)
export interface LeaderboardRow {
  username: string;
  avatar_url: string;
  name: string | null;
  overall_score: number;
  title: string;
  title_description: string;
  badges: string;
  categories: string;
  trend: string;
  evaluated_at: string;
  github_created_at: string;
}

const TRENDS: Record<string, { icon: string; className: string }> = {
  improving: { icon: "↑", className: "text-green-400" },
  stable: { icon: "→", className: "text-gray-300" },
  declining: { icon: "↓", className: "text-red-400" },
};

function TrendLabel({ trend }: { trend: string }) {
  const { t } = useTranslation();
  const known = TRENDS[trend];
  if (!known) return <span className="text-gray-300">{trend}</span>;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${known.className}`}>
      <span aria-hidden="true">{known.icon}</span>
      {t(`trend.${trend}`)}
    </span>
  );
}

const PAGE_LINK = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm transition ${FOCUS_RING}`;

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label={t("pagination.label")}
      className="mt-4 flex flex-wrap items-center justify-between gap-2"
    >
      {page > 1 ? (
        <Link
          href={leaderboardPageHref(page - 1)}
          rel="prev"
          prefetch={false}
          className={`${PAGE_LINK} gap-1 border-gray-700 bg-gray-900 text-gray-200 hover:border-purple-400 hover:text-white`}
        >
          <span aria-hidden="true">←</span>
          {t("pagination.prev")}
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      <ol className="flex items-center gap-1">
        {pages.map((n) => {
          const current = n === page;
          return (
            <li key={n}>
              <Link
                href={leaderboardPageHref(n)}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                aria-label={t("pagination.page", { page: n })}
                className={`${PAGE_LINK} tabular-nums ${
                  current
                    ? "border-purple-400 bg-purple-700 font-semibold text-white"
                    : "border-gray-700 bg-gray-900 text-gray-200 hover:border-purple-400 hover:text-white"
                }`}
              >
                {n}
              </Link>
            </li>
          );
        })}
      </ol>

      {page < totalPages ? (
        <Link
          href={leaderboardPageHref(page + 1)}
          rel="next"
          prefetch={false}
          className={`${PAGE_LINK} gap-1 border-gray-700 bg-gray-900 text-gray-200 hover:border-purple-400 hover:text-white`}
        >
          {t("pagination.next")}
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

export function LeaderboardView({
  rows,
  page,
  total,
}: {
  /** Rows of the current page rendered by the server; null when it could not read them. */
  rows: LeaderboardRow[] | null;
  /** 1-based page requested in the address. */
  page: number;
  /** Rows in the whole ranking (ignored when `rows` is null). */
  total: number;
}) {
  const { t, language } = useTranslation();
  const locale = localeFor(language);

  // Fallback only: the server could not read the database
  const [fetched, setFetched] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (rows !== null) return;
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        if (cancelled) return;
        setFetched(Array.isArray(data) ? (data as LeaderboardRow[]).slice(0, LEADERBOARD_MAX_ROWS) : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const pending = rows === null && fetched === null && !failed;
  const totalRows = rows !== null ? total : (fetched?.length ?? 0);
  const totalPages = leaderboardPageCount(totalRows);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * LEADERBOARD_PAGE_SIZE;
  const visible =
    rows !== null ? rows : (fetched ?? []).slice(start, start + LEADERBOARD_PAGE_SIZE);

  return (
    <PageShell>
      <h1 className="mb-2 text-3xl font-bold">
        <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          {t("leaderboard.title")}
        </span>
      </h1>
      <p className="mb-4 text-sm text-gray-300">{t("leaderboard.subtitle")}</p>
      <p className="mb-6 rounded-lg border border-purple-500/40 bg-purple-950/30 px-3 py-2 text-sm leading-relaxed text-gray-200">
        {t("leaderboard.periodNote")}
      </p>

      {pending ? (
        <div role="status" className="flex flex-col items-center gap-3 py-12">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-400"
          />
          <p className="text-sm text-gray-300">{t("leaderboard.loading")}</p>
        </div>
      ) : failed ? (
        <div
          role="alert"
          className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-200"
        >
          {t("leaderboard.unavailable")}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
          <p className="text-gray-300">{t("leaderboard.empty")}</p>
          <Link
            href="/"
            className={`mt-4 inline-flex min-h-11 items-center rounded-lg bg-purple-700 px-4 text-sm font-medium text-white transition hover:bg-purple-600 ${FOCUS_RING}`}
          >
            {t("leaderboard.evaluateFirst")}
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm">
              <caption className="caption-top border-b border-gray-800 px-3 py-2 text-left text-xs text-gray-300">
                {t("leaderboard.caption", {
                  from: start + 1,
                  to: start + visible.length,
                  total: totalRows,
                  period: t("period.all"),
                })}
              </caption>
              <thead className="border-b border-gray-800 bg-gray-900 text-xs uppercase text-gray-300">
                <tr>
                  <th scope="col" className="w-10 px-2 py-3 sm:px-3">
                    <span aria-hidden="true">#</span>
                    <span className="sr-only">{t("leaderboard.col.position")}</span>
                  </th>
                  <th scope="col" className="px-2 py-3 sm:px-3">
                    {t("leaderboard.col.developer")}
                  </th>
                  <th scope="col" className="px-2 py-3 text-center sm:px-3">
                    {t("leaderboard.col.score")}
                  </th>
                  <th scope="col" className="hidden px-3 py-3 sm:table-cell">
                    {t("leaderboard.col.title")}
                  </th>
                  <th scope="col" className="hidden px-3 py-3 md:table-cell">
                    {t("leaderboard.col.trend")}
                  </th>
                  <th scope="col" className="hidden px-3 py-3 md:table-cell">
                    {t("leaderboard.col.evaluated")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry, index) => {
                  const colorClass = getScoreColor(entry.overall_score);
                  const date = formatDate(entry.evaluated_at, locale);
                  return (
                    <tr
                      key={entry.username}
                      className="border-b border-gray-800/60 transition last:border-b-0 hover:bg-gray-900/50"
                    >
                      <td className="px-2 py-2 font-mono tabular-nums text-gray-300 sm:px-3">
                        {start + index + 1}
                      </td>
                      {/* w-full + max-w-0: the cell takes the free width and its text truncates */}
                      <th scope="row" className="w-full max-w-0 px-2 py-1 font-normal sm:px-3">
                        {/* period=all: open the profile on the period the ranking uses */}
                        <Link
                          href={leaderboardProfileHref(entry.username)}
                          prefetch={false}
                          className={`group flex min-h-11 min-w-0 items-center gap-2 rounded-md ${FOCUS_RING}`}
                        >
                          <img
                            src={sizedAvatarUrl(entry.avatar_url, 64)}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                            decoding="async"
                            className="h-8 w-8 shrink-0 rounded-full bg-gray-800"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-white group-hover:underline">
                              {entry.name || entry.username}
                            </span>
                            <span className="block truncate text-xs text-gray-400">
                              @{entry.username}
                            </span>
                          </span>
                        </Link>
                        {/* Narrow screens: the hidden columns move under the name */}
                        <div className="flex flex-wrap items-center gap-x-2 pb-1 pl-10 text-xs text-gray-400 md:hidden">
                          <span className="sm:hidden">{entry.title}</span>
                          <TrendLabel trend={entry.trend} />
                          <time dateTime={entry.evaluated_at}>{date}</time>
                        </div>
                      </th>
                      <td className="px-2 py-2 text-center sm:px-3">
                        <span className={`text-lg font-bold tabular-nums ${colorClass}`}>
                          {entry.overall_score}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-gray-200 sm:table-cell">
                        {entry.title}
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <TrendLabel trend={entry.trend} />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-gray-300 md:table-cell">
                        <time dateTime={entry.evaluated_at}>{date}</time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <p className="mt-4 text-center text-xs text-gray-300">
              {t("pagination.status", { page: currentPage, total: totalPages })}
            </p>
          )}
          <Pagination page={currentPage} totalPages={totalPages} />
        </>
      )}
    </PageShell>
  );
}
