// Single source of truth for the public identity of the site.
// "GitHub Stars" is the only brand; "DevStars" is just the repository name.

export const SITE_URL = "https://githubstars.iaen.es";
export const SITE_NAME = "GitHub Stars";
export const SITE_TAGLINE = "Score any developer by their public GitHub activity";
export const SITE_DESCRIPTION =
  "GitHub Stars scores any developer from 0 to 100 using only public GitHub activity: commits, pull requests, reviews, consistency, languages and seniority. Fun titles, badges and a public leaderboard.";
export const REPO_URL = "https://github.com/IAnMove/DevStars";

/** The leaderboard always stores the score of this period (see leaderboard-queue.ts). */
export const LEADERBOARD_PERIOD = "all" as const;

// Social cards are served by src/app/og/[file]/route.tsx. The ".png" suffix
// lets Cloudflare cache them by extension without any Cache Rule.
export const SITE_CARD_PATH = "/og/_site.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
