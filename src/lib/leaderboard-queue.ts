import { GitHubError, loadProfile, toGitHubError } from "@/lib/github";
import type { ApiErrorCode } from "@/lib/api-errors";
import { upsertEntry, isRecentlyEvaluated } from "@/lib/leaderboard-db";
import { singleton } from "@/lib/singleton";

/**
 * In-memory, single-worker queue that evaluates users one at a time and saves
 * the result in the leaderboard database. State lives in the server process:
 * it is lost on restart (queued users simply have to press the button again).
 *
 * The stored score is always the "all time" period (LEADERBOARD_PERIOD).
 */

type ItemStatus = "queued" | "processing" | "done" | "error";

interface QueueItem {
  username: string;
  status: ItemStatus;
  error?: string;
  code?: ApiErrorCode;
}

export interface QueueStatus {
  status: ItemStatus;
  position?: number;
  code?: ApiErrorCode;
}

export class QueueFullError extends Error {
  constructor() {
    super("Leaderboard queue is full");
    this.name = "QueueFullError";
  }
}

// Pending evaluations accepted at once; beyond this POST answers 503 "busy"
export const MAX_QUEUED = 50;

// How long finished (done/error) items stay visible to status polling
const FINISHED_ITEM_TTL_MS = 60000;

const state = singleton<{ queue: QueueItem[]; processing: boolean }>(
  "leaderboard-queue",
  () => ({ queue: [], processing: false })
);

function findItem(username: string): QueueItem | undefined {
  const lower = username.toLowerCase();
  return state.queue.find((item) => item.username.toLowerCase() === lower);
}

function describeItem(item: QueueItem): QueueStatus {
  if (item.status === "processing") return { status: "processing" };
  if (item.status === "done") return { status: "done" };
  if (item.status === "error") {
    return item.code ? { status: "error", code: item.code } : { status: "error" };
  }
  return {
    status: "queued",
    position: state.queue.filter((q) => q.status === "queued").indexOf(item) + 1,
  };
}

export function enqueue(username: string): QueueStatus {
  if (isRecentlyEvaluated(username)) return { status: "done" };

  const existing = findItem(username);
  // A failed item can be retried right away by pressing the button again
  if (existing && existing.status !== "error") return describeItem(existing);
  if (existing) state.queue.splice(state.queue.indexOf(existing), 1);

  const queued = state.queue.filter((q) => q.status === "queued").length;
  if (queued >= MAX_QUEUED) throw new QueueFullError();

  state.queue.push({ username, status: "queued" });
  if (!state.processing) void processQueue();
  return { status: "queued", position: queued + 1 };
}

export function getStatus(username: string): QueueStatus {
  if (isRecentlyEvaluated(username)) return { status: "done" };

  const existing = findItem(username);
  if (!existing) return { status: "done" };
  return describeItem(existing);
}

async function processQueue(): Promise<void> {
  if (state.processing) return;
  state.processing = true;

  try {
    while (true) {
      const item = state.queue.find((q) => q.status === "queued");
      if (!item) break;

      item.status = "processing";
      try {
        // Served from the in-memory cache when the profile was just viewed
        const { entry, cache } = await loadProfile(item.username);
        // Never stamp "evaluated now" on a copy GitHub could not refresh
        if (cache === "STALE") throw new GitHubError("upstream", { detail: "stale copy only" });
        const summary = entry.summary;

        upsertEntry({
          username: summary.login,
          avatar_url: summary.avatarUrl,
          name: summary.name,
          overall_score: summary.allTime.overall,
          title: summary.allTime.title,
          title_description: summary.allTime.titleDescription,
          badges: JSON.stringify(summary.allTime.badges),
          categories: JSON.stringify(summary.allTime.categories),
          trend: summary.trend,
          evaluated_at: new Date().toISOString(),
          github_created_at: summary.createdAt,
        });
        item.status = "done";
      } catch (err: unknown) {
        item.status = "error";
        if (err instanceof GitHubError) {
          const error = toGitHubError(err);
          item.code = error.code;
          item.error = error.message;
        } else {
          item.code = "internal";
          item.error = err instanceof Error ? err.message : "Unknown error";
        }
        console.error(`[queue] ${item.username} failed: ${item.code} (${item.error})`);
      }

      const timer = setTimeout(() => {
        const index = state.queue.indexOf(item);
        if (index !== -1 && (item.status === "done" || item.status === "error")) {
          state.queue.splice(index, 1);
        }
      }, FINISHED_ITEM_TTL_MS);
      timer.unref?.();
    }
  } finally {
    state.processing = false;
  }
}
