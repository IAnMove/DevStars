"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { CategoryScore } from "@/lib/types";

export function RadarChart({ categories }: { categories: CategoryScore[] }) {
  const data = categories.map((c) => ({
    category: c.name,
    score: c.score < 0 ? 0 : c.score,
    fullMark: 100,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#a855f7"
            fill="#a855f7"
            fillOpacity={0.3}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
