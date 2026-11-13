import { NextResponse } from "next/server";
import type { ApiErrorCode } from "./api-errors";

// Cache-Control policies (Cloudflare honours them only where it caches at all;
// browsers always do). Errors and personalised answers are never cached.
export const CACHE_NO_STORE = "no-store";
export const CACHE_GITHUB_OK = "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";
export const CACHE_GITHUB_STALE = "public, max-age=60";
export const CACHE_LEADERBOARD = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

/**
 * Error body shared by every API route: `{ error: string, code: string }`.
 * `error` keeps the historical field (now always a fixed, safe sentence);
 * `code` is the machine-readable addition (see api-errors.ts).
 */
export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options: { retryAfterSec?: number } = {}
): NextResponse {
  const headers: Record<string, string> = { "Cache-Control": CACHE_NO_STORE };
  if (options.retryAfterSec && options.retryAfterSec > 0) {
    headers["Retry-After"] = String(Math.ceil(options.retryAfterSec));
  }
  return NextResponse.json({ error: message, code }, { status, headers });
}

/**
 * Reads a small JSON body without trusting Content-Length.
 * Returns undefined when the body is too large or is not valid JSON.
 */
export async function readSmallJson(request: Request, maxBytes = 2048): Promise<unknown> {
  const declared = parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) return undefined;
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return undefined;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}
