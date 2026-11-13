import { NextRequest, NextResponse } from "next/server";
import { getStatus } from "@/lib/leaderboard-queue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const status = getStatus(username);
  return NextResponse.json(status);
}
