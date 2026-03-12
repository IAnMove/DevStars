"use client";

import { useTranslation } from "@/lib/i18n";

export function LoadingProgress() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-purple-500" />
      <p className="text-gray-400">{t("loading.message")}</p>
      <div className="mt-2 space-y-2 text-xs text-gray-600">
        <p>{t("loading.detail")}</p>
        <p>{t("loading.detail2")}</p>
      </div>
    </div>
  );
}
