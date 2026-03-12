"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { NormalizedData, RateLimitInfo, TimePeriod, Evolution } from "@/lib/types";
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

interface ApiResponse {
  data: NormalizedData;
  rateLimit: RateLimitInfo;
}

export default function UserPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NormalizedData | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1y");

  useEffect(() => {
    if (!params.username) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/github/${params.username}`);
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const result: ApiResponse = await res.json();
        const parsed = parseDates(result.data);
        setData(parsed);
        setRateLimit(result.rateLimit);
        const evo = calculateEvolution(parsed);
        setEvolution(evo);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.username]);

  if (loading) return <LoadingProgress />;

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold text-red-400">{t("error.title")}</h2>
          <p className="text-gray-400">{error}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-purple-500"
        >
          {t("error.goBack")}
        </button>
      </main>
    );
  }

  if (!data || !evolution) return null;

  const currentBreakdown = evolution.periods[selectedPeriod];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ProfileHeader profile={data.profile} />
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ShareButton
            username={data.profile.login}
            overall={currentBreakdown.overall}
            title={currentBreakdown.title.title}
            badges={currentBreakdown.badges}
            trend={evolution.trend}
          />
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
          >
            {t("results.newSearch")}
          </button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="mb-6">
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Overall Score + Radar */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="flex items-center justify-center rounded-lg border border-gray-800 bg-gray-900 p-6">
          <ScoreCircle
            score={currentBreakdown.overall}
            title={currentBreakdown.title.title}
            description={currentBreakdown.title.description}
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
