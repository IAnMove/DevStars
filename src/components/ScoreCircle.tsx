"use client";

import { getScoreColor } from "@/lib/gamification";

export function ScoreCircle({
  score,
  title,
  description,
  size = "lg",
}: {
  score: number;
  title: string;
  description?: string;
  size?: "lg" | "sm";
}) {
  const colorClass = getScoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const isLg = size === "lg";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${isLg ? "h-40 w-40" : "h-24 w-24"}`}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
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
            className={`${colorClass} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${colorClass} ${isLg ? "text-4xl" : "text-xl"}`}>
            {score}
          </span>
        </div>
      </div>
      {isLg && (
        <div className="text-center">
          <p className="text-lg font-semibold text-purple-300">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
