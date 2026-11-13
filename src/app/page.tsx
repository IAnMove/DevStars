import type { Metadata } from "next";
import { HomeSearch } from "@/components/HomeSearch";
import type { HomeTopEntry } from "@/components/HomeTopFive";
import { getTopEntries } from "@/lib/leaderboard-db";
import { pageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The top 5 comes straight from SQLite on every request (a 5-row indexed
// query), like /leaderboard: never read at build time, never stale.
export const dynamic = "force-dynamic";

const base = pageMetadata({
  title: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  path: "/",
});

export const metadata: Metadata = {
  ...base,
  // The home page is the one place where the brand goes first
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
};

function readTopFive(): HomeTopEntry[] | null {
  try {
    return getTopEntries(5).map((entry) => ({
      username: entry.username,
      avatar_url: entry.avatar_url,
      name: entry.name,
      overall_score: entry.overall_score,
      title: entry.title,
    }));
  } catch (err) {
    console.error("[home] top 5 query failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export default function Home() {
  return <HomeSearch topEntries={readTopFive()} />;
}
