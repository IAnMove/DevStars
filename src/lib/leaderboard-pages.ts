// Pagination helpers shared by the leaderboard page (server) and its view
// (client). Keep this module free of server-only imports.

/** Rows per leaderboard page. */
export const LEADERBOARD_PAGE_SIZE = 25;

/** The leaderboard shows at most this many rows (same cap as GET /api/leaderboard). */
export const LEADERBOARD_MAX_ROWS = 100;

/** Highest page number that can ever exist. */
export const LEADERBOARD_MAX_PAGES = Math.ceil(LEADERBOARD_MAX_ROWS / LEADERBOARD_PAGE_SIZE);

/**
 * Parses the `?page=` value. Missing → 1. Anything that is not a positive
 * integer → null (the caller decides what to do with a bad address).
 */
export function parseLeaderboardPage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) return null;
  return Number(raw);
}

export function leaderboardPageCount(totalRows: number): number {
  return Math.max(1, Math.ceil(totalRows / LEADERBOARD_PAGE_SIZE));
}

export function leaderboardPageHref(page: number): string {
  return page <= 1 ? "/leaderboard" : `/leaderboard?page=${page}`;
}

/** Profile link that opens on the period the leaderboard ranks by. */
export function leaderboardProfileHref(username: string): string {
  return `/user/${encodeURIComponent(username)}?period=all`;
}
