"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { getScoreColor } from "@/lib/gamification";
import { sizedAvatarUrl } from "@/lib/format";
import { leaderboardProfileHref } from "@/lib/leaderboard-pages";
import { FOCUS_RING } from "@/lib/ui";

/** Minimal projection of a leaderboard row for the home page. */
export interface HomeTopEntry {
  username: string;
  avatar_url: string;
  name: string | null;
  overall_score: number;
  title: string;
}

export function HomeTopFive({
  entries,
}: {
  /** Best rows of the ranking, read by the server; null when it could not read them. */
  entries: HomeTopEntry[] | null;
}) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="home-top-title" className="mt-12">
      <h2 id="home-top-title" className="text-xl font-bold text-white">
        {t("home.top.title")}
      </h2>
      <p className="mt-1 text-sm text-gray-300">
        {t("home.top.note", { period: t("period.all") })}
      </p>

      {entries === null ? (
        <p className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-200">
          {t("home.top.unavailable")}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-200">
          {t("leaderboard.empty")}
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-gray-800 rounded-lg border border-gray-800">
          {entries.map((entry, index) => (
            <li key={entry.username}>
              {/* period=all: open the profile on the period the ranking uses */}
              <Link
                href={leaderboardProfileHref(entry.username)}
                prefetch={false}
                className={`group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 transition hover:bg-gray-900 ${FOCUS_RING}`}
              >
                <span className="w-5 shrink-0 text-center font-mono text-sm tabular-nums text-gray-300">
                  {index + 1}
                </span>
                <img
                  src={sizedAvatarUrl(entry.avatar_url, 64)}
                  alt=""
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-8 shrink-0 rounded-full bg-gray-800"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white group-hover:underline">
                    {entry.name || entry.username}
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    @{entry.username} · {entry.title}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-lg font-bold tabular-nums ${getScoreColor(entry.overall_score)}`}
                >
                  {t("leaderboard.scoreOutOf", { score: entry.overall_score })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-2">
        <Link
          href="/leaderboard"
          className={`inline-flex min-h-11 items-center rounded-md text-sm font-medium text-purple-300 underline underline-offset-2 transition hover:text-purple-200 ${FOCUS_RING}`}
        >
          {t("home.top.all")}
        </Link>
      </p>
    </section>
  );
}
