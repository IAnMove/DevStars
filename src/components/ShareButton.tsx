"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { TimePeriod } from "@/lib/types";

type Feedback = "idle" | "copied" | "failed";

const FEEDBACK_MS = 2500;
/** Period the profile page opens with: no query string needed for it. */
const DEFAULT_PERIOD: TimePeriod = "1y";

function profileUrl(username: string, period: TimePeriod): string {
  const base = `${window.location.origin}/user/${encodeURIComponent(username)}`;
  return period === DEFAULT_PERIOD ? base : `${base}?period=${period}`;
}

/**
 * Shares the profile's own URL on this site. Uses the native share sheet
 * when the browser has one and falls back to copying text + URL.
 */
export function ShareButton({
  username,
  overall,
  title,
  period,
}: {
  username: string;
  overall: number;
  /** Already translated title for the selected period. */
  title: string;
  period: TimePeriod;
}) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = (next: Feedback) => {
    setFeedback(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback("idle"), FEEDBACK_MS);
  };

  const handleShare = async () => {
    const url = profileUrl(username, period);
    const text = t("share.text", {
      username,
      score: overall,
      title,
      period: t(`period.${period}`),
    });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("share.title", { username }), text, url });
        return;
      } catch (err) {
        // The user closed the share sheet: nothing else to do
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other failure: fall back to copying
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  const label =
    feedback === "copied"
      ? t("results.copied")
      : feedback === "failed"
        ? t("share.failed")
        : t("results.share");

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={`inline-flex min-h-11 items-center justify-center rounded-lg border bg-gray-900 px-4 text-sm font-medium transition hover:text-white ${
          feedback === "failed"
            ? "border-red-700 text-red-300"
            : "border-gray-700 text-gray-200 hover:border-purple-500"
        }`}
      >
        {label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {feedback === "copied" ? t("share.copiedLong") : ""}
        {feedback === "failed" ? t("share.failedLong") : ""}
      </span>
    </>
  );
}
