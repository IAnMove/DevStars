"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NormalizedData, RateLimitInfo, TimePeriod, Evolution } from "@/lib/types";
import { API_ERROR_CODES } from "@/lib/api-errors";
import type { ApiErrorCode } from "@/lib/api-errors";
import { calculateEvolution } from "@/lib/time-segmentation";
import { useTranslation } from "@/lib/i18n";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ScoreCircle } from "@/components/ScoreCircle";
import { RadarChart } from "@/components/RadarChart";
import { CategoryCard } from "@/components/CategoryCard";
import { EvolutionChart } from "@/components/EvolutionChart";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { ShareButton } from "@/components/ShareButton";
import { LoadingProgress } from "@/components/LoadingProgress";
import { RateLimitBadge } from "@/components/RateLimitBadge";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LeaderboardButton } from "@/components/LeaderboardButton";
import type { LeaderboardStanding } from "@/components/LeaderboardButton";
import { ErrorScreen } from "@/components/ErrorScreen";
import type { ScreenErrorCode } from "@/components/ErrorScreen";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

interface ApiResponse {
  data: NormalizedData;
  rateLimit: RateLimitInfo;
  fetchedAt?: string;
}

interface LoadError {
  code: ScreenErrorCode;
  retryAfterSec?: number;
}

function toErrorCode(value: unknown, httpStatus: number): ApiErrorCode {
  if (typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value)) {
    return value as ApiErrorCode;
  }
  if (httpStatus === 404) return "not_found";
  if (httpStatus === 429) return "rate_limited";
  return "internal";
}

export function UserProfile({
  username,
  initialPeriod = "1y",
}: {
  username: string;
  initialPeriod?: TimePeriod;
}) {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [data, setData] = useState<NormalizedData | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(initialPeriod);
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const [standing, setStanding] = useState<LeaderboardStanding | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/github/${encodeURIComponent(username)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
          if (cancelled) return;
          setError({
            code: toErrorCode(body?.code, res.status),
            retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : undefined,
          });
          return;
        }
        const result: ApiResponse = await res.json();
        if (cancelled) return;
        const parsed = parseDates(result.data);
        setData(parsed);
        setRateLimit(result.rateLimit);
        setStaleSince(
          res.headers.get("x-cache") === "STALE" && result.fetchedAt ? result.fetchedAt : null
        );
        setEvolution(calculateEvolution(parsed));
      } catch {
        if (!cancelled) setError({ code: "network" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  if (loading) return <LoadingProgress />;

  if (error) {
    return (
      <ErrorScreen
        code={error.code}
        username={username}
        retryAfterSec={error.retryAfterSec}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (!data || !evolution) return null;

  const currentBreakdown = evolution.periods[selectedPeriod];
  const locale = language === "es" ? "es-ES" : "en-US";
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Nav */}
      <div className="mb-6 flex items-center justify-between">
        <Nav />
        <LanguageSelector />
      </div>

      {staleSince && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-200"
        >
          {t("results.staleNotice", { date: formatDate(staleSince) })}
        </p>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ProfileHeader profile={data.profile} />
        <div className="flex flex-wrap items-center gap-2">
          <LeaderboardButton username={data.profile.login} onStanding={setStanding} />
          <ShareButton
            username={data.profile.login}
            overall={currentBreakdown.overall}
            title={currentBreakdown.title.title}
            badges={currentBreakdown.badges}
            trend={evolution.trend}
          />
          <Link
            href="/"
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
          >
            {t("results.newSearch")}
          </Link>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="mb-6">
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
        {/* Which period and date the leaderboard score refers to */}
        {standing && (
          <p className="mt-3 text-sm text-gray-400">
            {t("leaderboard.rankNote", {
              rank: standing.rank,
              score: standing.score,
              title: standing.title,
              date: formatDate(standing.evaluatedAt),
            })}{" "}
            {selectedPeriod !== "all" && (
              <button
                onClick={() => setSelectedPeriod("all")}
                className="font-medium text-purple-300 underline underline-offset-2 hover:text-purple-200"
              >
                {t("leaderboard.rankNote.show")}
              </button>
            )}
          </p>
        )}
      </div>

      {/* Overall Score + Radar */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900 p-6">
          <ScoreCircle
            score={currentBreakdown.overall}
            title={currentBreakdown.title.title}
            description={t(`title.${currentBreakdown.title.i18nKey}.desc`)}
            archetype={
              currentBreakdown.archetype
                ? {
                    icon: currentBreakdown.archetype.icon,
                    name: t(currentBreakdown.archetype.key),
                    desc: t(`${currentBreakdown.archetype.key}.desc`),
                  }
                : undefined
            }
          />
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-2 font-semibold text-white">{t("results.categoryOverview")}</h3>
          <RadarChart categories={currentBreakdown.categories} />
        </div>
      </div>

      {/* Badges */}
      {currentBreakdown.badges.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {currentBreakdown.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-purple-900/50 px-3 py-1 text-sm font-medium text-purple-300"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Category Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {currentBreakdown.categories.map((cat) => (
          <CategoryCard key={cat.key} category={cat} />
        ))}
      </div>

      {/* Evolution Chart */}
      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <EvolutionChart periods={evolution.periods} trend={evolution.trend} />
      </div>

      {/* Disclaimer */}
      <p className="mb-4 text-center text-xs text-gray-600">
        {t("results.disclaimer")}
      </p>

      {/* Rate Limit */}
      {rateLimit && (
        <div className="flex justify-center">
          <RateLimitBadge rateLimit={rateLimit} />
        </div>
      )}

      <Footer />
    </main>
  );
}

function parseDates(data: NormalizedData): NormalizedData {
  return {
    ...data,
    profile: {
      ...data.profile,
      createdAt: new Date(data.profile.createdAt),
    },
    repos: data.repos.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      pushedAt: new Date(r.pushedAt),
    })),
    commits: {
      ...data.commits,
      weeklyData: data.commits.weeklyData.map((w) => ({
        ...w,
        week: new Date(w.week),
      })),
    },
    pullRequests: data.pullRequests.map((pr) => ({
      ...pr,
      createdAt: new Date(pr.createdAt),
    })),
    issues: data.issues.map((i) => ({
      ...i,
      createdAt: new Date(i.createdAt),
    })),
    reviews: data.reviews.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
    })),
  };
}
