import type { Trend, CategoryScore, TitleInfo, NormalizedData, Archetype } from "@/lib/types";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TITLES: Array<{ max: number; key: string; title: string; description: string }> = [
  { max: 5, key: "helloWorldIntern", title: "Hello World Intern", description: "Just getting started. Everyone begins somewhere!" },
  { max: 10, key: "syntaxSeedling", title: "Syntax Seedling", description: "Planted the first seed. Learning to write code that runs." },
  { max: 15, key: "codePadawan", title: "Code Padawan", description: "Learning the ways of the code. Building first projects." },
  { max: 20, key: "bugWhisperer", title: "Bug Whisperer", description: "Starting to understand codebases and fix things." },
  { max: 25, key: "commitCadet", title: "Commit Cadet", description: "Regular contributor with growing habits." },
  { max: 30, key: "scriptArtisan", title: "Script Artisan", description: "Crafting scripts and tools. Getting comfortable with the craft." },
  { max: 35, key: "repoArchitect", title: "Repo Architect", description: "Building structured projects. Thinking about code organization." },
  { max: 40, key: "mergeRequestWarrior", title: "Merge Request Warrior", description: "Solid contributor who collaborates through PRs." },
  { max: 45, key: "debugDetective", title: "Debug Detective", description: "Tracks down bugs methodically. Problem solver in the making." },
  { max: 50, key: "bugSlayer", title: "Bug Slayer", description: "Experienced developer with consistent output." },
  { max: 55, key: "pipelineNinja", title: "Pipeline Ninja", description: "Highly active across multiple projects and languages." },
  { max: 60, key: "stackVoyager", title: "Stack Voyager", description: "Explores different technologies and stacks with confidence." },
  { max: 65, key: "codeAlchemist", title: "Code Alchemist", description: "Transforms ideas into working code. Versatile and productive." },
  { max: 70, key: "prGladiator", title: "PR Gladiator", description: "Battles through code reviews. Strong collaborator and reviewer." },
  { max: 75, key: "codeSensei", title: "Code Sensei", description: "Veteran developer with strong habits and broad impact." },
  { max: 80, key: "openSourceGuardian", title: "Open Source Guardian", description: "Protects and nurtures open source projects. Trusted maintainer." },
  { max: 85, key: "binarySage", title: "Binary Sage", description: "Deep knowledge and years of sustained contribution." },
  { max: 90, key: "openSourceTitan", title: "Open Source Titan", description: "Top-tier contributor driving open source forward." },
  { max: 95, key: "massDeployer", title: "Mass Deployer", description: "Ships at massive scale. Relentless force of engineering." },
  { max: 100, key: "gitOverlord", title: "Git Overlord", description: "Elite developer. Exceptional across all dimensions." },
];

export function getTitle(score: number): TitleInfo {
  for (const t of TITLES) {
    if (score <= t.max) return { title: t.title, description: t.description, i18nKey: t.key };
  }
  const last = TITLES[TITLES.length - 1];
  return { title: last.title, description: last.description, i18nKey: last.key };
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

  return `\u{1F3C6} ${SITE_NAME} - @${username}
Score: ${overall}/100 - "${title}" ${trendEmoji}
${badgeLine}${SITE_URL}/user/${username}`;
}

/**
 * Picks the developer "archetype" that best matches the shape of the activity
 * (reviews vs. PRs vs. issues vs. commits). Each candidate gets a 0-100 affinity
 * score (ratios plus fixed bonuses when a threshold holds) and the highest wins.
 */
export function getArchetype(data: NormalizedData, categories: CategoryScore[]): Archetype {
  const commits = data.commits.total;
  const prs = data.pullRequests.length;
  const reviews = data.reviews.length;
  const issues = data.issues.length;
  const externalPRs = data.pullRequests.filter((pr) => pr.isExternal).length;
  const externalIssues = data.issues.filter((i) => i.isExternal).length;
  const mergedPRs = data.pullRequests.filter((pr) => pr.state === "merged").length;
  const languageCount = new Set(data.repos.flatMap((r) => r.languages ?? [])).size;

  const totalActivity = commits + prs + reviews + issues;
  const catScore = (key: string) => categories.find((c) => c.key === key)?.score ?? 0;

  const reviewRatio = totalActivity > 0 ? reviews / totalActivity : 0;
  const prRatio = totalActivity > 0 ? prs / totalActivity : 0;
  const issueRatio = totalActivity > 0 ? issues / totalActivity : 0;
  const commitRatio = totalActivity > 0 ? commits / totalActivity : 0;

  const candidates: Array<Archetype & { score: number }> = [
    {
      key: "archetype.reviewer",
      icon: "\u{1F50D}",
      score: 60 * reviewRatio + (reviews > 20 ? 20 : 0) + (catScore("seniority") > 50 ? 20 : 0),
    },
    {
      key: "archetype.contributor",
      icon: "\u{1F91D}",
      score: 50 * (prs > 0 ? externalPRs / prs : 0) + (externalPRs > 10 ? 25 : 0) + (externalIssues > 5 ? 25 : 0),
    },
    {
      key: "archetype.builder",
      icon: "\u{1F3D7}\u{FE0F}",
      score: 40 * commitRatio + (commits > 200 ? 30 : 0) + (catScore("productividad") > 60 ? 30 : 0),
    },
    {
      key: "archetype.mergeMaster",
      icon: "\u{1F510}",
      score: 30 * (prs > 0 ? mergedPRs / prs : 0) + 40 * reviewRatio + (reviews > 10 && mergedPRs > 10 ? 30 : 0),
    },
    {
      key: "archetype.bugHunter",
      icon: "\u{1F41B}",
      score: 50 * issueRatio + (issues > 20 ? 30 : 0) + (externalIssues > 5 ? 20 : 0),
    },
    {
      key: "archetype.polyglot",
      icon: "\u{1F310}",
      score: 60 * Math.min(languageCount / 6, 1) + (catScore("diversidad") > 70 ? 40 : 0),
    },
    {
      key: "archetype.mentor",
      icon: "\u{1F9D1}\u{200D}\u{1F3EB}",
      score:
        (reviews > 15 ? 30 : 0) +
        (catScore("seniority") > 60 ? 35 : 0) +
        (catScore("consistencia") > 50 ? 35 : 0),
    },
    {
      key: "archetype.teamPlayer",
      icon: "\u{1F465}",
      score:
        (prRatio > 0.1 && prRatio < 0.5 ? 25 : 0) +
        (reviewRatio > 0.05 ? 25 : 0) +
        (issueRatio > 0.02 ? 25 : 0) +
        (commitRatio > 0.1 && commitRatio < 0.8 ? 25 : 0),
    },
  ];

  candidates.sort((a, b) => b.score - a.score);
  return { key: candidates[0].key, icon: candidates[0].icon };
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
