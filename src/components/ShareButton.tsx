"use client";

import { useState } from "react";
import { generateShareableSummary } from "@/lib/gamification";
import { useTranslation } from "@/lib/i18n";
import type { Trend } from "@/lib/types";

export function ShareButton({
  username,
  overall,
  title,
  badges,
  trend,
}: {
  username: string;
  overall: number;
  title: string;
  badges: string[];
  trend: Trend;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleShare = async () => {
    const text = generateShareableSummary(username, overall, title, badges, trend);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-purple-500 hover:text-white active:scale-95"
    >
      {copied ? t("results.copied") : t("results.share")}
    </button>
  );
}
