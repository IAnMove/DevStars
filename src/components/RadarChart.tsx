"use client";

import type { CategoryScore } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

// Pure SVG radar: no JS measuring, no entry animation (so it is complete in
// screenshots, link previews and crawlers), scales through viewBox.
const WIDTH = 400;
const HEIGHT = 300;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RADIUS = 95;
const LABEL_RADIUS = RADIUS + 16;
const RINGS = [25, 50, 75, 100];
const LINE_HEIGHT = 15;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function polar(index: number, total: number, radius: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / total;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: round(CX + radius * cos), y: round(CY + radius * sin), cos, sin };
}

function toPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function RadarChart({ categories }: { categories: CategoryScore[] }) {
  const { t } = useTranslation();
  const total = categories.length;
  if (total === 0) return null;

  const items = categories.map((c, index) => {
    const isNA = c.score < 0;
    const value = isNA ? 0 : Math.min(100, c.score);
    return {
      key: c.key,
      label: t(`category.${c.key}`),
      valueText: isNA ? t("common.na") : String(c.score),
      vertex: polar(index, total, (RADIUS * value) / 100),
      axisEnd: polar(index, total, RADIUS),
      labelAt: polar(index, total, LABEL_RADIUS),
    };
  });

  const title = t("chart.radar.title");
  const summary = items.map((i) => `${i.label}: ${i.valueText}`).join(", ");
  const accessibleName = `${title}. ${summary}`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={accessibleName}
        className="mx-auto block h-auto w-full max-w-md"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{accessibleName}</title>

        {/* Grid rings */}
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={toPoints(items.map((_, i) => polar(i, total, (RADIUS * ring) / 100)))}
            fill="none"
            stroke="#374151"
            strokeWidth={1}
          />
        ))}

        {/* Axes */}
        {items.map((item) => (
          <line
            key={item.key}
            x1={CX}
            y1={CY}
            x2={item.axisEnd.x}
            y2={item.axisEnd.y}
            stroke="#374151"
            strokeWidth={1}
          />
        ))}

        {/* Data */}
        <polygon
          points={toPoints(items.map((i) => i.vertex))}
          fill="#a855f7"
          fillOpacity={0.3}
          stroke="#c084fc"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {items.map((item) => (
          <circle key={item.key} cx={item.vertex.x} cy={item.vertex.y} r={3.5} fill="#c084fc">
            <title>{`${item.label}: ${item.valueText}`}</title>
          </circle>
        ))}

        {/* Labels: translated name + value, anchored away from the chart */}
        {items.map((item) => {
          const { x, y, cos, sin } = item.labelAt;
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          let nameY = y - 2;
          if (sin < -0.9) nameY = y - LINE_HEIGHT - 2;
          else if (sin > 0.9) nameY = y + 12;
          return (
            <g key={item.key} textAnchor={anchor}>
              <text x={x} y={round(nameY)} fontSize={13} fill="#d1d5db">
                {item.label}
              </text>
              <text
                x={x}
                y={round(nameY + LINE_HEIGHT)}
                fontSize={13}
                fontWeight={700}
                fill="#e9d5ff"
              >
                {item.valueText}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Same data for assistive technology */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{t("chart.col.category")}</th>
            <th scope="col">{t("chart.col.score")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.label}</th>
              <td>{item.valueText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
