"use client";

import type { TimePeriod, ScoreBreakdown, Trend } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { getTrendEmoji } from "@/lib/gamification";

const PERIOD_ORDER: TimePeriod[] = ["30d", "6m", "1y", "all"];

// Pure SVG line chart (4 points). No JS measuring and no entry animation.
const WIDTH = 400;
const HEIGHT = 210;
const LEFT = 34;
const RIGHT = 388;
const TOP = 24;
const BOTTOM = 170;
const X_PAD = 30;
const Y_TICKS = [0, 25, 50, 75, 100];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function yFor(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return round(BOTTOM - (clamped / 100) * (BOTTOM - TOP));
}

export function EvolutionChart({
  periods,
  trend,
}: {
  periods: Record<TimePeriod, ScoreBreakdown>;
  trend: Trend;
}) {
  const { t } = useTranslation();

  const step = (RIGHT - LEFT - 2 * X_PAD) / (PERIOD_ORDER.length - 1);
  const points = PERIOD_ORDER.map((p, index) => {
    const score = periods[p].overall;
    return {
      period: p,
      label: t(`period.${p}`),
      shortLabel: t(`period.short.${p}`),
      score,
      x: round(LEFT + X_PAD + index * step),
      y: yFor(score),
    };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = `M${first.x},${BOTTOM} L${points.map((p) => `${p.x},${p.y}`).join(" L")} L${last.x},${BOTTOM} Z`;

  const title = t("chart.evolution.title");
  const trendText = t(`trend.${trend}`);
  const summary = points.map((p) => `${p.label}: ${p.score}`).join(", ");
  const accessibleName = `${title}. ${summary}. ${trendText}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-white">{t("results.scoreEvolution")}</h2>
        <span className="text-sm text-gray-300">
          {trendText} <span aria-hidden="true">{getTrendEmoji(trend)}</span>
        </span>
      </div>
      <figure className="m-0">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={accessibleName}
          className="mx-auto block h-auto w-full max-w-xl"
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{accessibleName}</title>

          {/* Horizontal grid + Y axis values */}
          {Y_TICKS.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={LEFT}
                  y1={y}
                  x2={RIGHT}
                  y2={y}
                  stroke="#374151"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                />
                <text x={LEFT - 6} y={y + 4} fontSize={11} textAnchor="end" fill="#9ca3af">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Series */}
          <path d={area} fill="#a855f7" fillOpacity={0.12} />
          <polyline
            points={line}
            fill="none"
            stroke="#c084fc"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p) => (
            <g key={p.period}>
              <circle cx={p.x} cy={p.y} r={4.5} fill="#c084fc" stroke="#111827" strokeWidth={1.5}>
                <title>{`${p.label}: ${p.score}`}</title>
              </circle>
              <text
                x={p.x}
                y={round(p.y - 10)}
                fontSize={12}
                fontWeight={700}
                textAnchor="middle"
                fill="#e9d5ff"
              >
                {p.score}
              </text>
              <text x={p.x} y={BOTTOM + 20} fontSize={12} textAnchor="middle" fill="#d1d5db">
                {p.shortLabel}
              </text>
            </g>
          ))}
        </svg>

        {/* Same data for assistive technology */}
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{t("chart.col.period")}</th>
              <th scope="col">{t("chart.col.score")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.period}>
                <th scope="row">{p.label}</th>
                <td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
