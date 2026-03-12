"use client";

import type { RateLimitInfo } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

export function RateLimitBadge({ rateLimit }: { rateLimit: RateLimitInfo }) {
  const { t } = useTranslation();
  const pct = (rateLimit.remaining / rateLimit.limit) * 100;
  const color =
    pct > 50 ? "text-green-400" : pct > 20 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>{t("rateLimit.label")}:</span>
      <span className={color}>
        {rateLimit.remaining}/{rateLimit.limit}
      </span>
    </div>
  );
}
