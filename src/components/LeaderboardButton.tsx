"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

type ButtonStatus = "idle" | "queued" | "processing" | "done" | "error";

const POLL_INTERVAL_MS = 3000;

export function LeaderboardButton({ username }: { username: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [position, setPosition] = useState<number | null>(null);

  const checkStatus = useCallback(async () => {
    const res = await fetch(`/api/leaderboard/status/${username}`);
    const body = await res.json();
    setStatus(body.status);
    setPosition(body.position ?? null);
    return body.status as ButtonStatus;
  }, [username]);

  // While queued/processing, poll the server until it finishes
  useEffect(() => {
    if (status !== "queued" && status !== "processing") return;
    const interval = setInterval(async () => {
      const current = await checkStatus();
      if (current === "done" || current === "error") clearInterval(interval);
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
      const body = await res.json();
      setStatus(body.status);
      setPosition(body.position ?? null);
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <a
        href="/leaderboard"
        className="rounded-lg border border-green-700 bg-green-900/30 px-4 py-2 text-sm font-medium text-green-300 transition hover:bg-green-900/50"
      >
        {t("leaderboard.saved")}
      </a>
    );
  }

  if (status === "queued" || status === "processing") {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm font-medium text-yellow-300"
      >
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
        {status === "queued"
          ? `${t("leaderboard.queued")}${position ? ` #${position}` : ""}`
          : t("leaderboard.processing")}
      </button>
    );
  }

  if (status === "error") {
    return (
      <button
        onClick={handleSave}
        className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/50"
      >
        {t("leaderboard.error")}
      </button>
    );
  }

  return (
    <button
      onClick={handleSave}
      className="rounded-lg border border-purple-700 bg-purple-900/30 px-4 py-2 text-sm font-medium text-purple-300 transition hover:border-purple-500 hover:bg-purple-900/50 active:scale-95"
    >
      {t("leaderboard.save")}
    </button>
  );
}
