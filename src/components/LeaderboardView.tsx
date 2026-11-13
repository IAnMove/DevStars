"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getScoreColor } from "@/lib/gamification";

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

function parseBadges(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((b): b is string => typeof b === "string") : [];
  } catch {
    return [];
  }
}

export function LeaderboardView({
  initialEntries,
}: {
  /** Rows rendered by the server; null when the server could not read them. */
  initialEntries: LeaderboardRow[] | null;
}) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardRow[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(initialEntries === null);

  useEffect(() => {
    if (initialEntries !== null) return;
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        setEntries(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initialEntries]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Nav />
        <LanguageSelector />
      </div>

      <h1 className="mb-2 text-3xl font-bold">
        <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          {t("leaderboard.title")}
        </span>
      </h1>
      <p className="mb-2 text-sm text-gray-400">{t("leaderboard.subtitle")}</p>
      <p className="mb-6 text-xs leading-relaxed text-gray-400">{t("leaderboard.periodNote")}</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-purple-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">{t("leaderboard.empty")}</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            {t("leaderboard.evaluateFirst")}
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-900 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-3 w-10">#</th>
                <th className="px-3 py-3">{t("leaderboard.col.developer")}</th>
                <th className="px-3 py-3 text-center">{t("leaderboard.col.score")}</th>
                <th className="px-3 py-3">{t("leaderboard.col.title")}</th>
                <th className="px-3 py-3 hidden sm:table-cell">{t("leaderboard.col.badges")}</th>
                <th className="px-3 py-3 hidden md:table-cell">{t("leaderboard.col.evaluated")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const badges = parseBadges(entry.badges);
                const colorClass = getScoreColor(entry.overall_score);
                return (
                  <tr
                    key={entry.username}
                    className="border-b border-gray-800/50 transition hover:bg-gray-900/50"
                  >
                    <td className="px-3 py-3 font-mono text-gray-500">{index + 1}</td>
                    <td className="px-3 py-3">
                      {/* period=all: open the profile on the period the ranking uses */}
                      <Link
                        href={`/user/${entry.username}?period=all`}
                        prefetch={false}
                        className="flex items-center gap-2 hover:text-purple-300"
                      >
                        <img
                          src={entry.avatar_url}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          className="h-8 w-8 rounded-full"
                        />
                        <div>
                          <div className="font-medium text-white">
                            {entry.name || entry.username}
                          </div>
                          <div className="text-xs text-gray-500">@{entry.username}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-lg font-bold ${colorClass}`}>
                        {entry.overall_score}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{entry.title}</td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden text-xs text-gray-500 md:table-cell">
                      <time dateTime={entry.evaluated_at}>
                        {entry.evaluated_at.slice(0, 10)}
                      </time>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Footer />
    </main>
  );
}
