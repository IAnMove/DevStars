import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/leaderboard-queue";
import { getTopEntries, getByUsername } from "@/lib/leaderboard-db";

const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// Top 100 entries by score. `badges` and `categories` are JSON strings.
export async function GET() {
  try {
    const entries = getTopEntries(100);
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Leaderboard GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Queue a user for evaluation: body { username }.
// Responds { status: "queued", position } | { status: "processing" } |
// { status: "error" } | { status: "done", data: <row> }.
export async function POST(request: NextRequest) {
  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim();
  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const result = enqueue(username);
    if (result.status === "done") {
      const data = getByUsername(username);
      return NextResponse.json({ status: "done", data });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Leaderboard POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
