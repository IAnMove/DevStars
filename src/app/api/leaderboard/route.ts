import { NextRequest, NextResponse } from "next/server";
import { enqueue, QueueFullError } from "@/lib/leaderboard-queue";
import { getTopEntries, getByUsername } from "@/lib/leaderboard-db";
import { getClientIp, leaderboardPostLimiter } from "@/lib/rate-limit";
import { isValidUsername } from "@/lib/username";
import { CACHE_LEADERBOARD, CACHE_NO_STORE, jsonError, readSmallJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// Top 100 entries by score. `badges` and `categories` are JSON strings.
// Every score is the "all time" period at `evaluated_at`.
export async function GET() {
  try {
    const entries = getTopEntries(100);
    return NextResponse.json(entries, { headers: { "Cache-Control": CACHE_LEADERBOARD } });
  } catch (error) {
    console.error("Leaderboard GET error:", error);
    return jsonError(500, "internal", "Leaderboard temporarily unavailable");
  }
}

// Queue a user for evaluation: body { username }.
// Responds { status: "queued", position } | { status: "processing" } |
// { status: "error" } | { status: "done", data: <row> }.
export async function POST(request: NextRequest) {
  const decision = leaderboardPostLimiter.consume(getClientIp(request.headers));
  if (!decision.ok) {
    return jsonError(429, "rate_limited", "Too many requests, slow down", {
      retryAfterSec: decision.retryAfterSec,
    });
  }

  const body = await readSmallJson(request);
  if (body === undefined) {
    return jsonError(400, "invalid_request", "Invalid JSON");
  }

  const raw =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).username
      : undefined;
  const username = typeof raw === "string" ? raw.trim() : "";
  if (!isValidUsername(username)) {
    return jsonError(400, "invalid_username", "Invalid username");
  }

  try {
    const result = enqueue(username);
    const headers = { "Cache-Control": CACHE_NO_STORE };
    if (result.status === "done") {
      const data = getByUsername(username);
      return NextResponse.json({ status: "done", data }, { headers });
    }
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof QueueFullError) {
      return jsonError(503, "busy", "The evaluation queue is full, try again in a minute", {
        retryAfterSec: 60,
      });
    }
    console.error("Leaderboard POST error:", error);
    return jsonError(500, "internal", "Leaderboard temporarily unavailable");
  }
}
