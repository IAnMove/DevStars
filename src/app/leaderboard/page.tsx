import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/LeaderboardView";
import { getTopEntries } from "@/lib/leaderboard-db";
import type { LeaderboardEntry } from "@/lib/leaderboard-db";
import {
  LEADERBOARD_MAX_PAGES,
  LEADERBOARD_MAX_ROWS,
  LEADERBOARD_PAGE_SIZE,
  leaderboardPageCount,
  leaderboardPageHref,
  parseLeaderboardPage,
} from "@/lib/leaderboard-pages";
import { pageMetadata } from "@/lib/seo";

// Rendered on every request straight from SQLite (a 100-row indexed query),
// so the table is in the HTML and never older than the database.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const baseMetadata: Metadata = pageMetadata({
  title: "GitHub Leaderboard: top developers by public activity",
  description:
    "GitHub leaderboard of developers ranked by public activity: commits, pull requests, reviews, consistency, languages and seniority. Scores use each developer's all-time activity.",
  path: "/leaderboard",
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const page = parseLeaderboardPage((await searchParams).page);
  if (page === null || page <= 1 || page > LEADERBOARD_MAX_PAGES) return baseMetadata;
  // Each page of the ranking is its own document
  return {
    ...baseMetadata,
    alternates: { ...baseMetadata.alternates, canonical: leaderboardPageHref(page) },
  };
}

export default async function LeaderboardPage({ searchParams }: { searchParams: SearchParams }) {
  const requested = parseLeaderboardPage((await searchParams).page);
  // ?page=abc, ?page=0, repeated params…: back to the first page
  if (requested === null) redirect("/leaderboard");

  let all: LeaderboardEntry[] | null;
  try {
    all = getTopEntries(LEADERBOARD_MAX_ROWS);
  } catch (err) {
    console.error("[leaderboard] page query failed:", err instanceof Error ? err.message : err);
    all = null;
  }

  if (all === null) {
    // The client falls back to GET /api/leaderboard
    return <LeaderboardView rows={null} page={requested} total={0} />;
  }

  const totalPages = leaderboardPageCount(all.length);
  // Past the end: send the visitor to the last page that exists
  if (requested > totalPages) redirect(leaderboardPageHref(totalPages));

  const start = (requested - 1) * LEADERBOARD_PAGE_SIZE;
  return (
    <LeaderboardView
      rows={all.slice(start, start + LEADERBOARD_PAGE_SIZE)}
      page={requested}
      total={all.length}
    />
  );
}
