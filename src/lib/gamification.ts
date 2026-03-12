import type { Trend, CategoryScore, TitleInfo } from "@/lib/types";

const TITLES: Array<{ max: number; title: string; description: string }> = [
  { max: 10, title: "Hello World Intern", description: "Just getting started. Everyone begins somewhere!" },
  { max: 20, title: "Code Padawan", description: "Learning the ways of the code. Building first projects." },
  { max: 30, title: "Bug Whisperer", description: "Starting to understand codebases and fix things." },
  { max: 40, title: "Commit Cadet", description: "Regular contributor with growing habits." },
  { max: 50, title: "Merge Request Warrior", description: "Solid contributor who collaborates through PRs." },
  { max: 60, title: "Bug Slayer", description: "Experienced developer with consistent output." },
  { max: 70, title: "Pipeline Ninja", description: "Highly active across multiple projects and languages." },
  { max: 80, title: "Code Sensei", description: "Veteran developer with strong habits and broad impact." },
  { max: 90, title: "Open Source Titan", description: "Top-tier contributor driving open source forward." },
  { max: 100, title: "Git Overlord", description: "Elite developer. Exceptional across all dimensions." },
];

export function getTitle(score: number): TitleInfo {
  for (const t of TITLES) {
    if (score <= t.max) return { title: t.title, description: t.description };
  }
  return { title: TITLES[TITLES.length - 1].title, description: TITLES[TITLES.length - 1].description };
}

export function getCategoryBadges(categories: CategoryScore[]): string[] {
  const badgeMap: Record<string, string> = {
    productividad: "Commit Machine",
    calidad: "Clean Coder",
    colaboracion: "Community Hero",
    consistencia: "Streak Master",
    diversidad: "Polyglot Wizard",
    seniority: "Battle Tested",
  };

  return categories
    .filter((cat) => cat.score >= 70 && badgeMap[cat.key])
    .map((cat) => badgeMap[cat.key]);
}

export function getTrendEmoji(trend: Trend): string {
  const emojis: Record<Trend, string> = {
    improving: "\u{1F680}",
    stable: "\u{1F525}",
    declining: "\u{2744}\u{FE0F}",
  };
  return emojis[trend];
}

export function generateShareableSummary(
  username: string,
  overall: number,
  title: string,
  badges: string[],
  trend: Trend
): string {
  const trendEmoji = getTrendEmoji(trend);
  const badgeLine = badges.length > 0 ? `Badges: ${badges.join(", ")}\n` : "";

  return `\u{1F3C6} GitHub Dev Evaluator - @${username}
Score: ${overall}/100 - "${title}" ${trendEmoji}
${badgeLine}Evaluate yours at: [URL placeholder]`;
}

export function getScoreColor(score: number): string {
  if (score <= 30) return "text-red-500";
  if (score <= 50) return "text-orange-500";
  if (score <= 70) return "text-yellow-500";
  return "text-green-500";
}

export function getScoreColorHex(score: number): string {
  if (score <= 30) return "#ef4444";
  if (score <= 50) return "#f97316";
  if (score <= 70) return "#eab308";
  return "#22c55e";
}
