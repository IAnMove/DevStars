import type { TimePeriod, Trend, NormalizedData, ScoreBreakdown, Evolution } from '@/lib/types';
import { getScoreBreakdown } from '@/lib/scoring';

export function getTimePeriodMs(period: TimePeriod): number | null {
  const map: Record<TimePeriod, number | null> = {
    '30d': 30 * 24 * 60 * 60 * 1000,
    '6m': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
    'all': null,
  };
  return map[period];
}

export function filterByTimePeriod(data: NormalizedData, period: TimePeriod): NormalizedData {
  if (period === 'all') return data;

  const ms = getTimePeriodMs(period)!;
  const cutoff = new Date(Date.now() - ms);

  const repos = data.repos.filter((r) => new Date(r.pushedAt) >= cutoff);
  const weeklyData = data.commits.weeklyData.filter((w) => new Date(w.week) >= cutoff);
  const total = weeklyData.reduce((sum, w) => sum + w.count, 0);
  const pullRequests = data.pullRequests.filter((pr) => new Date(pr.createdAt) >= cutoff);
  const issues = data.issues.filter((i) => new Date(i.createdAt) >= cutoff);
  const reviews = data.reviews.filter((r) => new Date(r.createdAt) >= cutoff);

  return {
    profile: data.profile,
    repos,
    commits: { weeklyData, total },
    pullRequests,
    issues,
    reviews,
  };
}

export function detectTrend(score30d: number, score1y: number): Trend {
  if (score30d >= score1y + 10) return 'improving';
  if (score30d <= score1y - 10) return 'declining';
  return 'stable';
}

export function calculateEvolution(data: NormalizedData): Evolution {
  const periods = (['30d', '6m', '1y', 'all'] as const).reduce(
    (acc, period) => {
      const filtered = filterByTimePeriod(data, period);
      acc[period] = getScoreBreakdown(filtered);
      return acc;
    },
    {} as Record<TimePeriod, ScoreBreakdown>
  );

  const trend = detectTrend(periods['30d'].overall, periods['1y'].overall);

  return { periods, trend };
}

export function getTimePeriodLabel(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    '30d': 'Last 30 days',
    '6m': 'Last 6 months',
    '1y': 'Last year',
    'all': 'All time',
  };
  return labels[period];
}
