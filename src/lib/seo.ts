import type { Metadata } from "next";
import { LEADERBOARD_PERIOD, OG_IMAGE_SIZE, SITE_CARD_PATH, SITE_NAME, SITE_URL } from "./site";
import { findEntrySafe, getRank } from "./leaderboard-db";
import { getCachedSummary } from "./github";

// Server-only helpers for <head> metadata, JSON-LD and social cards.
// Everything here reads LOCAL data only (leaderboard row or in-memory cache):
// rendering metadata for a crawler must never spend GitHub quota.

export function ogImagePath(login: string): string {
  return `/og/${login}.png`;
}

/** Open Graph + Twitter + canonical for one page (page-level metadata replaces the layout's). */
export function pageMetadata(options: {
  title: string; // without the site name (the layout's template adds it)
  description: string;
  path: string; // canonical path, e.g. "/leaderboard"
  image?: string;
  imageAlt?: string;
  type?: "website" | "profile";
  index?: boolean;
}): Metadata {
  const image = options.image ?? SITE_CARD_PATH;
  const fullTitle = `${options.title} | ${SITE_NAME}`;
  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: options.path },
    robots: options.index === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: options.type ?? "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description: options.description,
      url: options.path,
      locale: "en_US",
      images: [{ url: image, ...OG_IMAGE_SIZE, alt: options.imageAlt ?? fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
      images: [image],
    },
  };
}

/** What the server knows about a profile without calling GitHub. */
export interface LocalProfile {
  login: string; // GitHub's casing when known, otherwise as requested
  name: string | null;
  avatarUrl: string | null;
  known: boolean;
  inLeaderboard: boolean;
  rank: number | null;
  score: number | null;
  title: string | null;
  /** Period the score refers to: leaderboard rows are "all", cached profiles "1y" (the page default). */
  period: "all" | "1y" | null;
  evaluatedAt: string | null;
  githubCreatedAt: string | null;
}

export function getLocalProfile(username: string): LocalProfile {
  const row = findEntrySafe(username);
  if (row) {
    let rank: number | null = null;
    try {
      rank = getRank(row);
    } catch {
      rank = null;
    }
    return {
      login: row.username,
      name: row.name,
      avatarUrl: row.avatar_url,
      known: true,
      inLeaderboard: true,
      rank,
      score: row.overall_score,
      title: row.title,
      period: LEADERBOARD_PERIOD,
      evaluatedAt: row.evaluated_at,
      githubCreatedAt: row.github_created_at,
    };
  }

  const summary = getCachedSummary(username);
  if (summary) {
    return {
      login: summary.login,
      name: summary.name,
      avatarUrl: summary.avatarUrl,
      known: true,
      inLeaderboard: false,
      rank: null,
      score: summary.periods["1y"].overall,
      title: summary.periods["1y"].title,
      period: "1y",
      evaluatedAt: null,
      githubCreatedAt: summary.createdAt,
    };
  }

  return {
    login: username,
    name: null,
    avatarUrl: null,
    known: false,
    inLeaderboard: false,
    rank: null,
    score: null,
    title: null,
    period: null,
    evaluatedAt: null,
    githubCreatedAt: null,
  };
}

export function formatDateEn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function profileMetadata(profile: LocalProfile): Metadata {
  const path = `/user/${profile.login}`;
  const who = profile.name ? `${profile.name} (@${profile.login})` : `@${profile.login}`;

  if (profile.inLeaderboard && profile.score !== null) {
    const when = profile.evaluatedAt ? `, evaluated on ${formatDateEn(profile.evaluatedAt)}` : "";
    return pageMetadata({
      title: `${who}: ${profile.score}/100 all-time, ${profile.title}`,
      description:
        `${who} scores ${profile.score}/100 ("${profile.title}") on the ${SITE_NAME} leaderboard` +
        `${profile.rank ? `, position #${profile.rank}` : ""}. Leaderboard scores use all-time public GitHub activity${when}. ` +
        `Open the profile for the breakdown by period: productivity, quality, collaboration, consistency, diversity and seniority.`,
      path,
      image: ogImagePath(profile.login),
      imageAlt: `${who}: ${profile.score}/100 on ${SITE_NAME}`,
      type: "profile",
      index: true,
    });
  }

  // Profiles that nobody saved to the leaderboard are not indexed: their
  // HTML has no stable content and we do not want crawlers to drive
  // evaluations of arbitrary usernames.
  if (profile.known && profile.score !== null) {
    return pageMetadata({
      title: `${who}: ${profile.score}/100 last year, ${profile.title}`,
      description:
        `${who} scores ${profile.score}/100 ("${profile.title}") on ${SITE_NAME} for the last year of public GitHub activity. ` +
        `See the breakdown by productivity, quality, collaboration, consistency, diversity and seniority.`,
      path,
      image: ogImagePath(profile.login),
      imageAlt: `${who}: ${profile.score}/100 on ${SITE_NAME}`,
      type: "profile",
      index: false,
    });
  }

  return pageMetadata({
    title: `@${profile.login}: GitHub developer score`,
    description: `Score from 0 to 100 for @${profile.login} based on public GitHub activity: commits, pull requests, reviews, consistency, languages and seniority.`,
    path,
    type: "profile",
    index: false,
  });
}

/** JSON-LD is embedded in a <script>: neutralise "<" so user-controlled names cannot close it. */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
}

export function profileJsonLd(profile: LocalProfile): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/user/${profile.login}`,
    ...(profile.evaluatedAt ? { dateModified: profile.evaluatedAt } : {}),
    mainEntity: {
      "@type": "Person",
      name: profile.name || profile.login,
      alternateName: profile.login,
      identifier: profile.login,
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      sameAs: [`https://github.com/${profile.login}`],
    },
  };
}
