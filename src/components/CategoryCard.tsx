"use client";

import type { CategoryScore } from "@/lib/types";
import { getScoreColor } from "@/lib/gamification";
import { useTranslation } from "@/lib/i18n";

const BADGE_MAP: Record<string, string> = {
  productividad: "badge.commitMachine",
  calidad: "badge.cleanCoder",
  colaboracion: "badge.communityHero",
  consistencia: "badge.streakMaster",
  diversidad: "badge.polyglotWizard",
  seniority: "badge.battleTested",
};

export function CategoryCard({ category }: { category: CategoryScore }) {
  const { t } = useTranslation();
  const colorClass = getScoreColor(category.score < 0 ? 0 : category.score);
  const badgeKey = category.score >= 70 ? BADGE_MAP[category.key] : null;
  const isNA = category.score < 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-white">{t(`category.${category.key}`)}</h3>
        <span className={`text-xl font-bold ${isNA ? "text-gray-600" : colorClass}`}>
          {isNA ? "N/A" : category.score}
        </span>
      </div>
      {badgeKey && (
        <span className="mb-2 inline-block rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">
          {t(badgeKey)}
        </span>
      )}
      <div className="mt-2 space-y-1">
        {Object.entries(category.metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-gray-400">{t(`metric.${key}`)}</span>
            <span className="text-gray-300">{formatMetricValue(value)}</span>
          </div>
        ))}
      </div>
      {!isNA && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
            style={{ width: `${category.score}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatMetricValue(value: number | string): string {
  if (typeof value === "string") return value;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(1);
}
