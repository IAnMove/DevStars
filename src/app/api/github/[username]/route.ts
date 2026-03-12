import { NextRequest, NextResponse } from "next/server";
import { fetchAllGitHubData } from "@/lib/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
    return NextResponse.json(
      { error: "Invalid GitHub username" },
      { status: 400 }
    );
  }

  try {
    const token = process.env.GITHUB_TOKEN || undefined;
    const result = await fetchAllGitHubData(username, token);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not Found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
