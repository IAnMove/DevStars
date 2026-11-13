import { fetchGitHubDataCached } from "@/lib/github";
import { calculateEvolution } from "@/lib/time-segmentation";
import { upsertEntry, isRecentlyEvaluated } from "@/lib/leaderboard-db";

/**
 * In-memory, single-worker queue that evaluates users one at a time and saves
 * the result in the leaderboard database. State lives in the server process:
 * it is lost on restart (queued users simply have to press the button again).
 */

type ItemStatus = "queued" | "processing" | "done" | "error";

interface QueueItem {
  username: string;
  status: ItemStatus;
  error?: string;
}

export interface QueueStatus {
  status: ItemStatus;
  position?: number;
}

const queue: QueueItem[] = [];
let processing = false;

// How long finished (done/error) items stay visible to status polling
const FINISHED_ITEM_TTL_MS = 60000;

function findItem(username: string): QueueItem | undefined {
  return queue.find((item) => item.username.toLowerCase() === username.toLowerCase());
}

function describeItem(item: QueueItem): QueueStatus {
  if (item.status === "processing") return { status: "processing" };
  if (item.status === "error") return { status: "error" };
  return {
    status: "queued",
    position: queue.filter((q) => q.status === "queued").indexOf(item) + 1,
  };
}

export function enqueue(username: string): QueueStatus {
  if (isRecentlyEvaluated(username)) return { status: "done" };

  const existing = findItem(username);
  if (existing) return describeItem(existing);

  queue.push({ username, status: "queued" });
  const position = queue.filter((q) => q.status === "queued").length;
  if (!processing) processQueue();
  return { status: "queued", position };
}

export function getStatus(username: string): QueueStatus {
  if (isRecentlyEvaluated(username)) return { status: "done" };

  const existing = findItem(username);
  if (!existing) return { status: "done" };
  return describeItem(existing);
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (true) {
    const item = queue.find((q) => q.status === "queued");
    if (!item) break;

    item.status = "processing";
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) throw new Error("GITHUB_TOKEN not configured on server");

      const { data } = await fetchGitHubDataCached(item.username, token);
      const evolution = calculateEvolution(data);
      const allTime = evolution.periods.all;

      upsertEntry({
        username: data.profile.login,
        avatar_url: data.profile.avatarUrl,
        name: data.profile.name,
        overall_score: allTime.overall,
        title: allTime.title.title,
        title_description: allTime.title.description,
        badges: JSON.stringify(allTime.badges),
        categories: JSON.stringify(
          allTime.categories.map((c) => ({ name: c.name, key: c.key, score: c.score }))
        ),
        trend: evolution.trend,
        evaluated_at: new Date().toISOString(),
        github_created_at: data.profile.createdAt.toISOString(),
      });
      item.status = "done";
    } catch (err: unknown) {
      item.status = "error";
      item.error = err instanceof Error ? err.message : "Unknown error";
      console.error(`Queue error for ${item.username}:`, item.error);
    }

    setTimeout(() => {
      const index = queue.indexOf(item);
      if (index !== -1 && (item.status === "done" || item.status === "error")) {
        queue.splice(index, 1);
      }
    }, FINISHED_ITEM_TTL_MS);
  }

  processing = false;
}
