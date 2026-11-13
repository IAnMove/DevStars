"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

type ButtonStatus = "idle" | "queued" | "processing" | "done" | "error";

/** What the leaderboard stores for a user (GET /api/leaderboard/status/<user>). */
export interface LeaderboardStanding {
  username: string;
  rank: number;
  score: number;
  title: string;
  period: string;
  evaluatedAt: string;
  canRefresh: boolean;
}

interface StatusBody {
  status?: "queued" | "processing" | "done" | "error";
  position?: number;
  inLeaderboard?: boolean;
  entry?: LeaderboardStanding;
}

const POLL_INTERVAL_MS = 3000;

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium";

export function LeaderboardButton({
  username,
  onStanding,
}: {
  username: string;
  /** Called whenever the server reports the user's leaderboard row (or its absence). */
  onStanding?: (standing: LeaderboardStanding | null) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [canRefresh, setCanRefresh] = useState(false);

  // Network only: asks the server where this user stands.
  const fetchStatus = useCallback(async (): Promise<StatusBody> => {
    const res = await fetch(`/api/leaderboard/status/${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as StatusBody;
  }, [username]);

  // Applies a server response to local state. `afterSave` = we are waiting for
  // an evaluation we queued, so "done" means "saved" even without details.
  const applyStatus = useCallback(
    (body: StatusBody, afterSave: boolean): ButtonStatus => {
      const standing = body.inLeaderboard && body.entry ? body.entry : null;
      onStanding?.(standing);
      setCanRefresh(Boolean(standing?.canRefresh));
      setRank(standing?.rank ?? null);
      setPosition(body.position ?? null);

      let next: ButtonStatus;
      if (body.status === "queued" || body.status === "processing") next = body.status;
      else if (body.status === "error") next = afterSave ? "error" : "idle";
      else if (standing && !standing.canRefresh) next = "done";
      // We queued it but there is no row: the evaluation was lost (restart)
      else if (afterSave && !standing) next = "error";
      else next = "idle";
      setStatus(next);
      return next;
    },
    [onStanding]
  );

  const checkStatus = useCallback(
    async (afterSave: boolean): Promise<ButtonStatus> =>
      applyStatus(await fetchStatus(), afterSave),
    [fetchStatus, applyStatus]
  );

  // On mount: is the user already on the leaderboard (or being evaluated)?
  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((body) => {
        if (!cancelled) applyStatus(body, false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchStatus, applyStatus]);

  // While queued/processing, poll the server until it finishes
  useEffect(() => {
    if (status !== "queued" && status !== "processing") return;
    const interval = setInterval(async () => {
      try {
        const current = await checkStatus(true);
        if (current === "done" || current === "error") clearInterval(interval);
      } catch {
        // transient network error: keep polling
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, checkStatus]);

  const handleSave = async () => {
    setStatus("queued");
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const body: StatusBody = await res.json();
      if (!res.ok || !body.status) {
        setStatus("error");
        return;
      }
      setPosition(body.position ?? null);
      if (body.status === "done") {
        // Already evaluated in the last 24 h: refresh rank/score details
        await checkStatus(true).catch(() => setStatus("done"));
      } else {
        setStatus(body.status);
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <Link
        href="/leaderboard"
        className={`${BASE} border-green-700 bg-green-900/30 text-green-300 transition hover:bg-green-900/50`}
      >
        {rank ? t("leaderboard.savedRank", { rank }) : t("leaderboard.saved")}
      </Link>
    );
  }

  if (status === "queued" || status === "processing") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${BASE} border-yellow-700 bg-yellow-900/30 text-yellow-200`}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent motion-reduce:animate-none"
        />
        {status === "queued"
          ? `${t("leaderboard.queued")}${position ? ` #${position}` : ""}`
          : t("leaderboard.processing")}
      </div>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={handleSave}
        className={`${BASE} border-red-700 bg-red-900/30 text-red-300 transition hover:bg-red-900/50`}
      >
        {t("leaderboard.error")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      className={`${BASE} border-purple-700 bg-purple-900/30 text-purple-200 transition hover:border-purple-500 hover:bg-purple-900/50`}
    >
      {canRefresh ? t("leaderboard.update") : t("leaderboard.save")}
    </button>
  );
}
