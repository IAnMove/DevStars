import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserProfile } from "@/components/UserProfile";
import { isKnownMissingUser } from "@/lib/github";
import { getLocalProfile, profileJsonLd, profileMetadata, safeJsonLd } from "@/lib/seo";
import { isValidUsername } from "@/lib/username";
import type { TimePeriod } from "@/lib/types";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PERIODS: readonly TimePeriod[] = ["30d", "6m", "1y", "all"];

// Title, description, canonical and social card come from local data only
// (leaderboard row or in-memory cache): no GitHub call is made for <head>.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (!isValidUsername(username)) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return profileMetadata(getLocalProfile(username));
}

export default async function UserPage({ params, searchParams }: Props) {
  const { username } = await params;

  // Not a possible GitHub login -> real 404 (no evaluation, no soft-404)
  if (!isValidUsername(username)) notFound();
  // GitHub told us recently that this user does not exist -> real 404
  if (isKnownMissingUser(username)) notFound();

  // ?period=all lets the leaderboard link to the same period it ranks by
  const requested = (await searchParams).period;
  const initialPeriod = PERIODS.find((p) => p === requested) ?? "1y";

  const profile = getLocalProfile(username);

  return (
    <>
      {profile.inLeaderboard && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(profileJsonLd(profile)) }}
        />
      )}
      <UserProfile key={username.toLowerCase()} username={username} initialPeriod={initialPeriod} />
    </>
  );
}
