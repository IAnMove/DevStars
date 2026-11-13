import { NextRequest, NextResponse } from "next/server";
import { loadProfile, peekProfile, toGitHubError } from "@/lib/github";
import type { CacheStatus, ProfileEntry } from "@/lib/github";
import { getClientIp, githubMissLimiter } from "@/lib/rate-limit";
import { isValidUsername } from "@/lib/username";
import { CACHE_GITHUB_OK, CACHE_GITHUB_STALE, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

function profileResponse(
  request: NextRequest,
  entry: ProfileEntry,
  cache: CacheStatus
): NextResponse {
  const headers: Record<string, string> = {
    "Cache-Control": cache === "STALE" ? CACHE_GITHUB_STALE : CACHE_GITHUB_OK,
    ETag: entry.etag,
    "Last-Modified": new Date(entry.fetchedAt).toUTCString(),
    "X-Cache": cache,
  };
  if (request.headers.get("if-none-match") === entry.etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  headers["Content-Type"] = "application/json";
  // The body is the pre-serialized {"data":…,"rateLimit":…,"fetchedAt":…}
  return new NextResponse(new Uint8Array(entry.body), { status: 200, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!isValidUsername(username)) {
    return jsonError(400, "invalid_username", "Invalid GitHub username");
  }

  // Nothing below may `await` before loadProfile(): concurrent requests for
  // the same user must see the in-flight fetch and not be charged for it.
  const peek = peekProfile(username);

  if (peek.kind === "hit") return profileResponse(request, peek.entry, "HIT");
  if (peek.kind === "not_found") {
    return jsonError(404, "not_found", "GitHub user not found");
  }

  if (peek.kind === "miss") {
    // Only requests that will actually spend GitHub quota count against the IP
    const decision = githubMissLimiter.consume(getClientIp(request.headers));
    if (!decision.ok) {
      if (peek.stale) return profileResponse(request, peek.stale, "STALE");
      return jsonError(429, "rate_limited", "Too many requests, slow down", {
        retryAfterSec: decision.retryAfterSec,
      });
    }
  }

  try {
    const result = await loadProfile(username);
    return profileResponse(request, result.entry, result.cache);
  } catch (err: unknown) {
    const error = toGitHubError(err);
    return jsonError(error.status, error.code, error.message, {
      retryAfterSec: error.retryAfterSec,
    });
  }
}
