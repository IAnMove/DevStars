import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/leaderboard-db";
import { SITE_URL } from "@/lib/site";

// Built on request from SQLite: home, leaderboard and every profile saved to
// the leaderboard (the only profiles we ask search engines to index).
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  let users: Array<{ username: string; evaluated_at: string }> = [];
  try {
    users = getSitemapEntries(5000);
  } catch (err) {
    console.error("[sitemap] leaderboard query failed:", err instanceof Error ? err.message : err);
  }

  const newest = users.reduce<string | null>(
    (latest, u) => (latest === null || u.evaluated_at > latest ? u.evaluated_at : latest),
    null
  );

  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/leaderboard`,
      changeFrequency: "daily",
      priority: 0.8,
      ...(newest ? { lastModified: new Date(newest) } : {}),
    },
    ...users.map((u) => ({
      url: `${SITE_URL}/user/${u.username}`,
      lastModified: new Date(u.evaluated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
