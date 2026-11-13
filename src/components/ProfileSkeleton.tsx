"use client";

import { LoadingProgress } from "@/components/LoadingProgress";

const BLOCK = "animate-pulse rounded bg-gray-800 motion-reduce:animate-none";
const CARD = "rounded-lg border border-gray-800 bg-gray-900 p-4";

/**
 * Loading state of the profile page with the same shape as the final page,
 * so nothing jumps when data arrives. The h1 is real (we already know the
 * login from the URL); the grey blocks are decorative.
 */
export function ProfileSkeleton({ username }: { username: string }) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div aria-hidden="true" className={`h-16 w-16 shrink-0 rounded-full ${BLOCK}`} />
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-white sm:text-2xl">@{username}</h1>
            <div aria-hidden="true" className={`mt-3 h-3 w-40 ${BLOCK}`} />
            <div aria-hidden="true" className={`mt-2 h-3 w-28 ${BLOCK}`} />
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          <div className={`h-11 w-40 rounded-lg ${BLOCK}`} />
          <div className={`h-11 w-24 rounded-lg ${BLOCK}`} />
          <div className={`h-11 w-32 rounded-lg ${BLOCK}`} />
        </div>
      </div>

      <div className="mb-6">
        <LoadingProgress />
      </div>

      <div aria-hidden="true">
        {/* Period selector + leaderboard note */}
        <div className="mb-6">
          <div className={`h-12 w-full rounded-lg sm:w-96 ${BLOCK}`} />
          <div className={`mt-3 h-12 w-full rounded-lg ${BLOCK}`} />
        </div>

        {/* Score + radar */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <div className={`${CARD} flex h-80 flex-col items-center justify-center gap-4`}>
            <div className={`h-40 w-40 rounded-full ${BLOCK}`} />
            <div className={`h-4 w-36 ${BLOCK}`} />
            <div className={`h-3 w-48 ${BLOCK}`} />
          </div>
          <div className={`${CARD} h-80`}>
            <div className={`h-4 w-40 ${BLOCK}`} />
            <div className="flex h-full items-center justify-center pb-6">
              <div className={`h-48 w-48 rounded-full ${BLOCK}`} />
            </div>
          </div>
        </div>

        {/* Category cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${CARD} h-44`}>
              <div className="flex items-center justify-between">
                <div className={`h-4 w-28 ${BLOCK}`} />
                <div className={`h-6 w-8 ${BLOCK}`} />
              </div>
              <div className="mt-4 space-y-2">
                <div className={`h-3 w-full ${BLOCK}`} />
                <div className={`h-3 w-5/6 ${BLOCK}`} />
                <div className={`h-3 w-2/3 ${BLOCK}`} />
              </div>
              <div className={`mt-5 h-1.5 w-full rounded-full ${BLOCK}`} />
            </div>
          ))}
        </div>

        {/* Evolution chart */}
        <div className={`${CARD} mb-6 h-64`}>
          <div className={`h-4 w-44 ${BLOCK}`} />
          <div className={`mt-4 h-44 w-full ${BLOCK}`} />
        </div>
      </div>
    </div>
  );
}
