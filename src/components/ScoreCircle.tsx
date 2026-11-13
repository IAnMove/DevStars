"use client";

import { getScoreColor } from "@/lib/gamification";

export function ScoreCircle({
  score,
  title,
  description,
  archetype,
  periodLabel,
  size = "lg",
}: {
  score: number;
  title: string;
  description?: string;
  archetype?: { icon: string; name: string; desc: string };
  /** Already translated text saying which period the score refers to. */
  periodLabel?: string;
  size?: "lg" | "sm";
}) {
  const colorClass = getScoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const isLg = size === "lg";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${isLg ? "h-40 w-40" : "h-24 w-24"}`}>
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-gray-800"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-700 motion-reduce:transition-none`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${colorClass} ${isLg ? "text-4xl" : "text-xl"}`}>
            {score}
            <span className="sr-only"> / 100</span>
          </span>
        </div>
      </div>
      {isLg && (
        <div className="text-center">
          {periodLabel && <p className="mb-1 text-xs text-gray-400">{periodLabel}</p>}
          <p className="text-lg font-semibold text-purple-300">{title}</p>
          {description && <p className="mt-1 text-sm text-gray-300">{description}</p>}
          {archetype && (
            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
              <p className="text-sm font-medium text-white">
                <span aria-hidden="true">{archetype.icon}</span> {archetype.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-300">{archetype.desc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
