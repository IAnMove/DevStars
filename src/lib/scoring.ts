import type {
  NormalizedData,
  CategoryScore,
  ScoreBreakdown,
} from "@/lib/types";
import { getTitle, getCategoryBadges } from "@/lib/gamification";

const log2 = Math.log2;

export function calculateProductividad(data: NormalizedData): CategoryScore {
  const totalCommits = data.commits.total;
  const repoCount = data.repos.length;
  const activeWeeks = data.commits.weeklyData.filter((w) => w.count > 0);
  const commitsPerActiveWeek =
    activeWeeks.length > 0 ? totalCommits / activeWeeks.length : 0;

  const commitScore = Math.min(log2(totalCommits + 1) / log2(401), 1) * 40;
  const repoScore = Math.min(log2(repoCount + 1) / log2(16), 1) * 30;
  const frequencyScore = Math.min(commitsPerActiveWeek / 10, 1) * 30;

  const score = Math.min(
    Math.round(commitScore + repoScore + frequencyScore),
    100
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

  const score = Math.min(
    Math.round(prVolumeScore + mergeBonus + reviewScore),
    100
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

  const score = Math.min(
    Math.round(
      Math.min(log2(externalRepos + 1) / log2(9), 1) * 40 +
        Math.min(log2(externalPRs.length + 1) / log2(16), 1) * 35 +
        Math.min(log2(externalIssues.length + 1) / log2(11), 1) * 25
    ),
    100
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

export function calculateConsistencia(data: NormalizedData): CategoryScore {
  const weeklyData = data.commits.weeklyData;
  const activeWeeks = weeklyData.filter((w) => w.count > 0).length;
  const totalWeeks = Math.max(weeklyData.length, 1);
  const activeRatio = activeWeeks / totalWeeks;

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

  let consistency = 0;
  if (weeklyData.length > 0) {
    const counts = weeklyData.map((w) => w.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (mean > 0) {
      const variance =
        counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length;
      const stddev = Math.sqrt(variance);
      consistency = 1 / (1 + stddev / mean);
    }
  }

  const score = Math.min(
    Math.round(
      activeRatio * 40 +
        Math.min(longestStreak / 12, 1) * 30 +
        consistency * 30
    ),
    100
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
      consistency: Math.round(consistency * 100) / 100,
    },
  };
}

export function calculateDiversidad(data: NormalizedData): CategoryScore {
  const languageSet = new Set<string>();
  for (const repo of data.repos) {
    if (repo.language) languageSet.add(repo.language);
  }
  const languageCount = languageSet.size;
  const languages = Array.from(languageSet).join(", ");

  let contributionTypes = 0;
  if (data.commits.total > 0) contributionTypes++;
  if (data.pullRequests.length > 0) contributionTypes++;
  if (data.issues.length > 0) contributionTypes++;

  const score = Math.min(
    Math.round(
      Math.min(languageCount / 5, 1) * 60 + (contributionTypes / 3) * 40
    ),
    100
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

  const score = Math.min(
    Math.round(ageScore + sustainedScore + avgActivityScore),
    100
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

  return {
    overall,
    categories,
    title,
    badges,
    trend: "stable",
  };
}
