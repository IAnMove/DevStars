"use client";

import { useTranslation } from "@/lib/i18n";

/** Announced loading message. Sits inside the page skeleton, not full screen. */
export function LoadingProgress() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-gray-700 border-t-purple-400 motion-reduce:animate-none"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-100">{t("loading.message")}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {t("loading.detail")} {t("loading.detail2")}
        </p>
      </div>
    </div>
  );
}
