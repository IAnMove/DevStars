"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NormalizedData, RateLimitInfo, TimePeriod, Evolution } from "@/lib/types";
import { API_ERROR_CODES } from "@/lib/api-errors";
import type { ApiErrorCode } from "@/lib/api-errors";
import { calculateEvolution } from "@/lib/time-segmentation";
import { useTranslation } from "@/lib/i18n";
import { localeFor } from "@/lib/format";
import { PageShell } from "@/components/PageShell";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ScoreCircle } from "@/components/ScoreCircle";
import { RadarChart } from "@/components/RadarChart";
import { CategoryCard } from "@/components/CategoryCard";
import { EvolutionChart } from "@/components/EvolutionChart";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { ShareButton } from "@/components/ShareButton";
import { RateLimitBadge } from "@/components/RateLimitBadge";
import { LeaderboardButton } from "@/components/LeaderboardButton";
import type { LeaderboardStanding } from "@/components/LeaderboardButton";
import { ErrorScreen } from "@/components/ErrorScreen";
import type { ScreenErrorCode } from "@/components/ErrorScreen";

interface ApiResponse {
  data: NormalizedData;
  rateLimit: RateLimitInfo;
  fetchedAt?: string;
}

interface LoadError {
  code: ScreenErrorCode;
  retryAfterSec?: number;
}

const CARD = "rounded-lg border border-gray-800 bg-gray-900";

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

  if (loading) {
    return (
      <PageShell>
        <ProfileSkeleton username={username} />
      </PageShell>
    );
  }

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

  if (!data || !evolution) {
    return <ErrorScreen code="internal" username={username} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const currentBreakdown = evolution.periods[selectedPeriod];
  const allTimeScore = evolution.periods.all.overall;
  const periodName = t(`period.${selectedPeriod}`);
  const translatedTitle = t(`title.${currentBreakdown.title.i18nKey}`);
  const dateFormat = new Intl.DateTimeFormat(localeFor(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
  };

  let periodNote: string;
  if (standing) {
    periodNote = t("leaderboard.rankNote", {
      rank: standing.rank,
      score: standing.score,
      title: standing.title,
      date: formatDate(standing.evaluatedAt),
    });
  } else if (selectedPeriod === "all") {
    periodNote = t("profile.periodNote.all");
  } else {
    periodNote = t("profile.periodNote.other", { period: periodName, score: allTimeScore });
  }

  return (
    <PageShell>
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
            title={translatedTitle}
            period={selectedPeriod}
          />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 px-4 text-sm text-gray-200 transition hover:border-purple-500 hover:text-white"
          >
            {t("results.newSearch")}
          </Link>
        </div>
      </div>

      {/* Period selector + which period the leaderboard uses */}
      <div className="mb-6">
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
        <div className="mt-3 rounded-lg border border-purple-900 bg-purple-950/40 px-3 py-2 text-sm text-gray-200">
          <p>{periodNote}</p>
          {selectedPeriod !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedPeriod("all")}
              className="inline-flex min-h-11 items-center rounded-md font-medium text-purple-300 underline underline-offset-2 transition hover:text-purple-200"
            >
              {t("leaderboard.rankNote.show")}
            </button>
          )}
        </div>
      </div>

      {/* Overall score + radar */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <section
          aria-labelledby="overall-score-heading"
          className={`${CARD} flex items-center justify-center p-6`}
        >
          <h2 id="overall-score-heading" className="sr-only">
            {t("results.overallScore")}
          </h2>
          <ScoreCircle
            score={currentBreakdown.overall}
            title={translatedTitle}
            description={t(`title.${currentBreakdown.title.i18nKey}.desc`)}
            periodLabel={t("results.scorePeriod", { period: periodName })}
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
        </section>
        <section className={`${CARD} min-w-0 p-4`}>
          <h2 className="mb-2 font-semibold text-white">{t("results.categoryOverview")}</h2>
          <RadarChart categories={currentBreakdown.categories} />
        </section>
      </div>

      {/* Badges */}
      {currentBreakdown.badges.length > 0 && (
        <section className="mb-6">
          <h2 className="sr-only">{t("results.badges")}</h2>
          <ul className="flex flex-wrap gap-2">
            {currentBreakdown.badges.map((badge) => (
              <li
                key={badge}
                className="rounded-full bg-purple-900/50 px-3 py-1 text-sm font-medium text-purple-200"
              >
                {badge}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Category cards */}
      <section className="mb-6">
        <h2 className="sr-only">{t("results.categories")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentBreakdown.categories.map((cat) => (
            <CategoryCard key={cat.key} category={cat} />
          ))}
        </div>
      </section>

      {/* Evolution chart */}
      <section className={`${CARD} mb-6 min-w-0 p-4`}>
        <EvolutionChart periods={evolution.periods} trend={evolution.trend} />
      </section>

      {/* Disclaimer */}
      <p className="mb-4 text-center text-xs text-gray-400">{t("results.disclaimer")}</p>

      {/* Rate limit */}
      {rateLimit && (
        <div className="flex justify-center">
          <RateLimitBadge rateLimit={rateLimit} />
        </div>
      )}
    </PageShell>
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
