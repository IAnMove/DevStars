"use client";

import type { TimePeriod } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

const PERIODS: TimePeriod[] = ["30d", "6m", "1y", "all"];

export function TimePeriodSelector({
  selected,
  onChange,
}: {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("period.label")}
      className="flex w-full gap-1 rounded-lg border border-gray-700 bg-gray-900 p-1 sm:inline-flex sm:w-auto"
    >
      {PERIODS.map((p) => {
        const active = selected === p;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p)}
            className={`inline-flex min-h-11 min-w-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition sm:flex-none ${
              active ? "bg-purple-700 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {/* Compact label on small screens; the full one stays as the accessible name */}
            <span aria-hidden="true" className="sm:hidden">
              {t(`period.short.${p}`)}
            </span>
            <span className="sr-only sm:not-sr-only">{t(`period.${p}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
