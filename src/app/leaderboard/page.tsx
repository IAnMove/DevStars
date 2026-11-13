import type { Metadata } from "next";
import { LeaderboardView } from "@/components/LeaderboardView";
import { getTopEntries } from "@/lib/leaderboard-db";
import type { LeaderboardEntry } from "@/lib/leaderboard-db";
import { pageMetadata } from "@/lib/seo";

// Rendered on every request straight from SQLite (a 100-row indexed query),
// so the table is in the HTML and never older than the database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "GitHub Leaderboard: top developers by public activity",
  description:
    "GitHub leaderboard of developers ranked by public activity: commits, pull requests, reviews, consistency, languages and seniority. Scores use each developer's all-time activity.",
  path: "/leaderboard",
});

export default function LeaderboardPage() {
  let entries: LeaderboardEntry[] | null;
  try {
    entries = getTopEntries(100);
  } catch (err) {
    console.error("[leaderboard] page query failed:", err instanceof Error ? err.message : err);
    entries = null; // the client falls back to GET /api/leaderboard
  }
  return <LeaderboardView initialEntries={entries} />;
}
