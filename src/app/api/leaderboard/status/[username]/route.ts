import { NextRequest, NextResponse } from "next/server";
import { getStatus } from "@/lib/leaderboard-queue";
import { getByUsername, getRank, isRecent } from "@/lib/leaderboard-db";
import { isValidUsername } from "@/lib/username";
import { CACHE_NO_STORE, jsonError } from "@/lib/http";
import { LEADERBOARD_PERIOD } from "@/lib/site";

export const dynamic = "force-dynamic";

// { status, position? } as always, plus:
//   inLeaderboard  whether the user has a row in the leaderboard
//   entry          (only when inLeaderboard) what the leaderboard shows for
//                  this user and which period that score refers to
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!isValidUsername(username)) {
    return jsonError(400, "invalid_username", "Invalid username");
  }

  try {
    const status = getStatus(username);
    const row = getByUsername(username);
    const body = row
      ? {
          ...status,
          inLeaderboard: true,
          entry: {
            username: row.username,
            rank: getRank(row),
            score: row.overall_score,
            title: row.title,
            period: LEADERBOARD_PERIOD,
            evaluatedAt: row.evaluated_at,
            // false while the 24 h cool-down since the last evaluation lasts
            canRefresh: !isRecent(row),
          },
        }
      : { ...status, inLeaderboard: false };
    return NextResponse.json(body, { headers: { "Cache-Control": CACHE_NO_STORE } });
  } catch (error) {
    console.error("Leaderboard status error:", error);
    return jsonError(500, "internal", "Leaderboard temporarily unavailable");
  }
}
