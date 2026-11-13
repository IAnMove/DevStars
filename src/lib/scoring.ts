import type {
  NormalizedData,
  CategoryScore,
  ScoreBreakdown,
} from "@/lib/types";
import { getTitle, getCategoryBadges, getArchetype } from "@/lib/gamification";

const log2 = Math.log2;

/**
 * Non-linear curve applied to every raw category score (0-100).
 * Lifts the low/mid range (raw 60 -> 65) and makes the top harder to reach.
 */
export function applyCurve(raw: number): number {
  if (raw <= 0) return 0;
  if (raw >= 100) return 100;
  if (raw <= 60) return Math.round(65 * Math.pow(raw / 60, 0.8));
  return Math.round(65 + 35 * Math.pow((raw - 60) / 40, 1.4));
}

export function calculateProductividad(data: NormalizedData): CategoryScore {
  const totalCommits = data.commits.total;
  const repoCount = data.repos.length;
  const weeklyData = data.commits.weeklyData;
  const activeWeeks = weeklyData.filter((w) => w.count > 0);
  const totalWeeks = Math.max(weeklyData.length, 1);
  const commitsPerActiveWeek =
    activeWeeks.length > 0 ? totalCommits / activeWeeks.length : 0;
  const activeRatio = Math.min(activeWeeks.length / (totalWeeks * 0.9), 1);

  const commitScore = Math.min(log2(totalCommits + 1) / log2(401), 1) * 30;
  const repoScore = Math.min(log2(repoCount + 1) / log2(16), 1) * 25;
  const frequencyScore = Math.min(commitsPerActiveWeek / 3, 1) * 20;
  const regularityScore = activeRatio * 25;

  const score = applyCurve(
    Math.min(
      Math.round(commitScore + repoScore + frequencyScore + regularityScore),
      100
    )
  );

  return {
    name: "Productividad",
    key: "productividad",
    weight: 0.2,
    score,
    metrics: {
      totalCommits,
      repoCount,
      commitsPerActiveWeek: Math.round(commitsPerActiveWeek * 10) / 10,
    },
  };
}

export function calculateCalidad(data: NormalizedData): CategoryScore {
  const totalPRs = data.pullRequests.length;
  const mergedPRs = data.pullRequests.filter(
    (pr) => pr.state === "merged"
  ).length;
  const reviewsDone = data.reviews.length;
  const mergeRatio = totalPRs > 0 ? mergedPRs / totalPRs : 0;

  if (totalPRs === 0 && reviewsDone === 0) {
    return {
      name: "Calidad",
      key: "calidad",
      weight: 0.15,
      score: -1,
      metrics: { totalPRs: 0, mergedPRs: 0, mergeRatio: 0, reviewsDone: 0 },
    };
  }

  // PR volume is the main driver (opening PRs = work, regardless of merge)
  // Merged PRs get a bonus on top
  // Reviews done add significant points (indicates seniority)
  const prVolumeScore = Math.min(log2(totalPRs + 1) / log2(26), 1) * 35;
  const mergeBonus = mergeRatio * 25;
  const reviewScore = Math.min(log2(reviewsDone + 1) / log2(31), 1) * 40;

  const score = applyCurve(
    Math.min(Math.round(prVolumeScore + mergeBonus + reviewScore), 100)
  );

  return {
    name: "Calidad",
    key: "calidad",
    weight: 0.15,
    score,
    metrics: {
      totalPRs,
      mergedPRs,
      mergeRatio: Math.round(mergeRatio * 100) / 100,
      reviewsDone,
    },
  };
}

export function calculateColaboracion(data: NormalizedData): CategoryScore {
  const externalPRs = data.pullRequests.filter((pr) => pr.isExternal);
  const externalIssues = data.issues.filter((i) => i.isExternal);

  const externalRepoSet = new Set<string>();
  for (const pr of externalPRs) externalRepoSet.add(pr.repo);
  for (const issue of externalIssues) externalRepoSet.add(issue.repo);
  const externalRepos = externalRepoSet.size;

  const score = applyCurve(
    Math.min(
      Math.round(
        Math.min(log2(externalRepos + 1) / log2(9), 1) * 40 +
          Math.min(log2(externalPRs.length + 1) / log2(16), 1) * 35 +
          Math.min(log2(externalIssues.length + 1) / log2(11), 1) * 25
      ),
      100
    )
  );

  return {
    name: "Colaboracion",
    key: "colaboracion",
    weight: 0.2,
    score,
    metrics: {
      externalPRs: externalPRs.length,
      externalIssues: externalIssues.length,
      externalRepos,
    },
  };
}

/**
 * Month-level activity: a month counts as active if anything happened in it
 * (repo created/pushed, PR, issue, review, or a week with commits).
 */
function getMonthlyActivity(data: NormalizedData): {
  activeMonths: number;
  totalMonths: number;
  monthlyRatio: number;
} {
  const months = new Set<string>();

  for (const repo of data.repos) {
    const pushed = new Date(repo.pushedAt);
    const created = new Date(repo.createdAt);
    months.add(`${pushed.getFullYear()}-${pushed.getMonth()}`);
    months.add(`${created.getFullYear()}-${created.getMonth()}`);
  }
  for (const pr of data.pullRequests) {
    const d = new Date(pr.createdAt);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  for (const issue of data.issues) {
    const d = new Date(issue.createdAt);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  for (const review of data.reviews) {
    const d = new Date(review.createdAt);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  for (const week of data.commits.weeklyData) {
    if (week.count > 0) {
      const d = new Date(week.week);
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
  }

  const activeMonths = months.size;
  const createdAt = new Date(data.profile.createdAt);
  const now = new Date();
  const totalMonths = Math.max(
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
      (now.getMonth() - createdAt.getMonth()),
    1
  );
  const monthlyRatio = Math.min(activeMonths / (totalMonths * 0.83), 1);

  return { activeMonths, totalMonths, monthlyRatio };
}

export function calculateConsistencia(data: NormalizedData): CategoryScore {
  const weeklyData = data.commits.weeklyData;
  const activeWeeks = weeklyData.filter((w) => w.count > 0).length;
  const totalWeeks = Math.max(weeklyData.length, 1);
  const monthly = getMonthlyActivity(data);
  const activeRatio = Math.max(
    Math.min(activeWeeks / (totalWeeks * 0.9), 1),
    monthly.monthlyRatio
  );

  let longestStreak = 0;
  let currentStreak = 0;
  for (const week of weeklyData) {
    if (week.count > 0) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Regularity is measured over active weeks only
  let consistency = 0;
  const activeCounts = weeklyData.filter((w) => w.count > 0).map((w) => w.count);
  if (activeCounts.length > 0) {
    const mean = activeCounts.reduce((a, b) => a + b, 0) / activeCounts.length;
    if (mean > 0) {
      const variance =
        activeCounts.reduce((sum, c) => sum + (c - mean) ** 2, 0) /
        activeCounts.length;
      const stddev = Math.sqrt(variance);
      consistency = 1 / (1 + stddev / mean);
    }
  }
  if (activeCounts.length === 0 && monthly.activeMonths > 0) consistency = 0.5;

  const score = applyCurve(
    Math.min(
      Math.round(
        activeRatio * 45 +
          Math.min(longestStreak / 8, 1) * 25 +
          consistency * 30
      ),
      100
    )
  );

  return {
    name: "Consistencia",
    key: "consistencia",
    weight: 0.15,
    score,
    metrics: {
      activeWeeks,
      totalWeeks,
      longestStreak,
      consistency: Math.round(activeRatio * 100) / 100,
    },
  };
}

export function calculateDiversidad(data: NormalizedData): CategoryScore {
  // language -> total bytes across repos (0 when byte sizes are unknown)
  const languageMap = new Map<string, number>();
  for (const repo of data.repos) {
    if (repo.languageBytes) {
      for (const [lang, bytes] of Object.entries(repo.languageBytes)) {
        languageMap.set(lang, (languageMap.get(lang) || 0) + bytes);
      }
    } else if (repo.languages?.length) {
      for (const lang of repo.languages) {
        if (!languageMap.has(lang)) languageMap.set(lang, 0);
      }
    } else if (repo.language && !languageMap.has(repo.language)) {
      languageMap.set(repo.language, 0);
    }
  }
  const languageCount = languageMap.size;
  const totalBytes = Array.from(languageMap.values()).reduce((a, b) => a + b, 0);
  const languages = Array.from(languageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lang, bytes]) => {
      if (totalBytes > 0) {
        const pct = Math.round((bytes / totalBytes) * 100);
        return pct > 0 ? `${lang} ${pct}%` : lang;
      }
      return lang;
    })
    .join(", ");

  let contributionTypes = 0;
  if (data.commits.total > 0) contributionTypes++;
  if (data.pullRequests.length > 0) contributionTypes++;
  if (data.issues.length > 0) contributionTypes++;

  const score = applyCurve(
    Math.min(
      Math.round(
        Math.min(languageCount / 5, 1) * 60 + (contributionTypes / 3) * 40
      ),
      100
    )
  );

  return {
    name: "Diversidad",
    key: "diversidad",
    weight: 0.15,
    score,
    metrics: { languageCount, languages, contributionTypes },
  };
}

export function calculateSeniority(data: NormalizedData): CategoryScore {
  const now = new Date();
  const createdAt = new Date(data.profile.createdAt);
  const accountAgeMs = now.getTime() - createdAt.getTime();
  const accountAgeYears = Math.max(accountAgeMs / (365.25 * 86400000), 0.1);

  // Determine active years: years with at least one repo pushed or created
  const activeYearSet = new Set<number>();
  for (const repo of data.repos) {
    activeYearSet.add(new Date(repo.pushedAt).getFullYear());
    activeYearSet.add(new Date(repo.createdAt).getFullYear());
  }
  for (const pr of data.pullRequests) {
    activeYearSet.add(new Date(pr.createdAt).getFullYear());
  }
  const activeYears = activeYearSet.size;
  const activeYearRatio = Math.min(activeYears / Math.max(Math.ceil(accountAgeYears), 1), 1);

  const avgCommitsPerYear = data.commits.total / accountAgeYears;

  const ageScore = Math.min(accountAgeYears / 8, 1) * 25;
  const sustainedScore = activeYearRatio * 40;
  const avgActivityScore =
    Math.min(log2(avgCommitsPerYear + 1) / log2(101), 1) * 35;

  const score = applyCurve(
    Math.min(Math.round(ageScore + sustainedScore + avgActivityScore), 100)
  );

  return {
    name: "Seniority",
    key: "seniority",
    weight: 0.15,
    score,
    metrics: {
      accountAgeYears: Math.round(accountAgeYears * 10) / 10,
      activeYears,
      activeYearRatio: Math.round(activeYearRatio * 100) / 100,
      avgCommitsPerYear: Math.round(avgCommitsPerYear),
    },
  };
}

export function calculateOverallScore(categories: CategoryScore[]): number {
  const available = categories.filter((c) => c.score >= 0);
  if (available.length === 0) return 0;

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = available.reduce(
    (sum, c) => sum + c.score * (c.weight / totalWeight),
    0
  );

  return Math.min(Math.max(Math.round(weightedSum), 0), 100);
}

export function getScoreBreakdown(data: NormalizedData): ScoreBreakdown {
  const categories: CategoryScore[] = [
    calculateProductividad(data),
    calculateCalidad(data),
    calculateColaboracion(data),
    calculateConsistencia(data),
    calculateDiversidad(data),
    calculateSeniority(data),
  ];

  const overall = calculateOverallScore(categories);
  const title = getTitle(overall);
  const badges = getCategoryBadges(categories);
  const archetype = getArchetype(data, categories);

  return {
    overall,
    categories,
    title,
    badges,
    archetype,
    trend: "stable",
  };
}
