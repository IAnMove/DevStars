"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimePeriod, ScoreBreakdown, Trend } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { getTrendEmoji } from "@/lib/gamification";

const PERIOD_ORDER: TimePeriod[] = ["30d", "6m", "1y", "all"];

export function EvolutionChart({
  periods,
  trend,
}: {
  periods: Record<TimePeriod, ScoreBreakdown>;
  trend: Trend;
}) {
  const { t } = useTranslation();

  const data = PERIOD_ORDER.map((p) => ({
    period: t(`period.${p}`),
    score: periods[p].overall,
  }));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-semibold text-white">{t("results.scoreEvolution")}</h3>
        <span className="text-sm text-gray-400">
          {t(`trend.${trend}`)} {getTrendEmoji(trend)}
        </span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ fill: "#a855f7", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
