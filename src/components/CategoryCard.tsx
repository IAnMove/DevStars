"use client";

import type { CategoryScore } from "@/lib/types";
import { getScoreColor } from "@/lib/gamification";
import { useTranslation } from "@/lib/i18n";
import { formatNumber, formatPercent, localeFor } from "@/lib/format";

const BADGE_MAP: Record<string, string> = {
  productividad: "badge.commitMachine",
  calidad: "badge.cleanCoder",
  colaboracion: "badge.communityHero",
  consistencia: "badge.streakMaster",
  diversidad: "badge.polyglotWizard",
  seniority: "badge.battleTested",
};

/** Metrics that scoring exposes as a 0–1 ratio and that read better as a percentage. */
const RATIO_METRICS = new Set(["mergeRatio", "activeYearRatio", "consistency"]);

interface LanguageChip {
  name: string;
  /** 0–1, or null when the source text carries no percentage. */
  share: number | null;
}

/** "C++ 54%, C 30%, Shell 2%" -> chips. Falls back to a plain list of names. */
function parseLanguages(value: string): LanguageChip[] {
  const chips: LanguageChip[] = [];
  const pair = /([^,;·|%]+?)\s*[:(]?\s*(\d+(?:\.\d+)?)\s*%\)?/g;
  let match: RegExpExecArray | null = pair.exec(value);
  while (match !== null) {
    const name = match[1].trim();
    const share = Number(match[2]);
    if (name) chips.push({ name, share: Number.isFinite(share) ? share / 100 : null });
    match = pair.exec(value);
  }
  if (chips.length > 0) return chips;
  return value
    .split(/[,;·|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ name, share: null }));
}

function formatMetricValue(key: string, value: number | string, locale: string): string {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "–";
  if (RATIO_METRICS.has(key)) {
    // Defensive: accept 0–1 ratios and, just in case, 0–100 values
    return formatPercent(value > 1 ? value / 100 : value, locale);
  }
  return formatNumber(value, locale);
}

export function CategoryCard({ category }: { category: CategoryScore }) {
  const { t, language } = useTranslation();
  const locale = localeFor(language);
  const isNA = category.score < 0;
  const colorClass = getScoreColor(isNA ? 0 : category.score);
  const badgeKey = category.score >= 70 ? BADGE_MAP[category.key] : null;
  const width = Math.max(0, Math.min(100, category.score));

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">{t(`category.${category.key}`)}</h3>
        <span className={`text-xl font-bold ${isNA ? "text-gray-400" : colorClass}`}>
          {isNA ? t("common.na") : category.score}
        </span>
      </div>
      {badgeKey && (
        <span className="mb-2 inline-block rounded-full bg-purple-900/50 px-2 py-0.5 text-xs text-purple-200">
          {t(badgeKey)}
        </span>
      )}
      <dl className="mt-2 space-y-1.5 text-xs">
        {Object.entries(category.metrics).map(([key, value]) => {
          if (key === "languages" && typeof value === "string") {
            const chips = parseLanguages(value);
            if (chips.length === 0) return null;
            return (
              <div key={key} className="pt-1">
                <dt className="text-gray-400">{t(`metric.${key}`)}</dt>
                <dd className="mt-1.5">
                  <ul className="flex flex-wrap gap-1.5">
                    {chips.map((chip, index) => (
                      <li
                        key={`${chip.name}-${index}`}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-gray-100"
                      >
                        <span>{chip.name}</span>
                        {chip.share !== null && (
                          <span className="text-gray-300">
                            {formatPercent(chip.share, locale, 1)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            );
          }
          return (
            <div key={key} className="flex items-baseline justify-between gap-3">
              <dt className="text-gray-400">{t(`metric.${key}`)}</dt>
              <dd className="break-words text-right font-medium text-gray-200">
                {formatMetricValue(key, value, locale)}
              </dd>
            </div>
          );
        })}
      </dl>
      {!isNA && (
        <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700 motion-reduce:transition-none"
            style={{ width: `${width}%` }}
          />
        </div>
      )}
    </div>
  );
}
