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
    <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            selected === p
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {t(`period.${p}`)}
        </button>
      ))}
    </div>
  );
}
