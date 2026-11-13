import { singleton } from "./singleton.ts";

/**
 * In-memory sliding-window rate limiter (no external services).
 *
 * Each key keeps the timestamps of its recent hits (at most the largest
 * `limit` of its rules), so memory is bounded by maxKeys * maxLimit numbers.
 * State is per process and is lost on restart, which is fine for abuse control.
 *
 * Note: this file is also run directly by Node's native type stripping in
 * tests, so it avoids non-erasable TypeScript syntax (no parameter properties,
 * enums or namespaces) and uses explicit ".ts" import extensions.
 */

export interface RateRule {
  limit: number;
  windowMs: number;
}

export type RateDecision = { ok: true } | { ok: false; retryAfterSec: number };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly rules: RateRule[];
  private readonly maxKeys: number;
  private readonly longestWindowMs: number;
  private readonly maxLimit: number;
  private calls = 0;

  constructor(rules: RateRule[], maxKeys = 5000) {
    this.rules = rules;
    this.maxKeys = maxKeys;
    this.longestWindowMs = Math.max(...rules.map((r) => r.windowMs));
    this.maxLimit = Math.max(...rules.map((r) => r.limit));
  }

  /** Registers a hit for `key` if every rule allows it. */
  consume(key: string, now = Date.now()): RateDecision {
    if (++this.calls % 500 === 0) this.sweep(now);

    const previous = this.hits.get(key) ?? [];
    const recent = previous.filter((t) => now - t < this.longestWindowMs);

    let retryAfterMs = 0;
    for (const rule of this.rules) {
      const inWindow = recent.filter((t) => now - t < rule.windowMs);
      if (inWindow.length >= rule.limit) {
        // The oldest hit that still counts decides when a slot frees up
        const oldest = inWindow[inWindow.length - rule.limit];
        retryAfterMs = Math.max(retryAfterMs, oldest + rule.windowMs - now);
      }
    }

    // Refresh recency (Map keeps insertion order => cheap LRU)
    this.hits.delete(key);

    if (retryAfterMs > 0) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    recent.push(now);
    if (recent.length > this.maxLimit) recent.splice(0, recent.length - this.maxLimit);
    this.hits.set(key, recent);

    while (this.hits.size > this.maxKeys) {
      const oldestKey = this.hits.keys().next().value;
      if (oldestKey === undefined) break;
      this.hits.delete(oldestKey);
    }
    return { ok: true };
  }

  private sweep(now: number): void {
    for (const [key, stamps] of this.hits) {
      if (stamps.length === 0 || now - stamps[stamps.length - 1] >= this.longestWindowMs) {
        this.hits.delete(key);
      }
    }
  }

  get size(): number {
    return this.hits.size;
  }
}

// ------------------------------------------------------------
// Client identification
// ------------------------------------------------------------

/**
 * Normalises an IP so it can be used as a rate-limit key.
 * IPv6 addresses are reduced to their /64 prefix (a single customer usually
 * owns the whole /64, so per-address limits would be trivial to dodge).
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim().toLowerCase();
  if (ip.length === 0 || ip.length > 64) return null;
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    ip = ip.slice(1, end === -1 ? undefined : end);
  }
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (!/^[0-9a-f:]+$/.test(ip) || !ip.includes(":")) return null;

  const [head, tail] = ip.split("::") as [string, string | undefined];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = tail === undefined ? 0 : Math.max(0, 8 - headParts.length - tailParts.length);
  const full = [...headParts, ...Array<string>(missing).fill("0"), ...tailParts];
  if (full.length !== 8) return null;
  return full.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

/**
 * Best available client IP:
 *  1. CF-Connecting-IP (set by Cloudflare; only trustworthy while the origin
 *     is reachable exclusively through Cloudflare),
 *  2. first hop of X-Forwarded-For (Next fills it with the socket address
 *     when no proxy sent it),
 *  3. "unknown" (all such clients share one bucket).
 */
export function getClientIp(headers: Headers): string {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
  ];
  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  return "unknown";
}

// ------------------------------------------------------------
// Limiters used by the API routes
// ------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** GitHub evaluations that miss the cache (each one spends GitHub quota). */
export const githubMissLimiter = singleton(
  "rate:github-miss",
  () =>
    new SlidingWindowLimiter([
      { limit: 10, windowMs: MINUTE },
      { limit: 60, windowMs: HOUR },
    ])
);

/** POST /api/leaderboard (queues an evaluation and writes to SQLite). */
export const leaderboardPostLimiter = singleton(
  "rate:leaderboard-post",
  () =>
    new SlidingWindowLimiter([
      { limit: 10, windowMs: MINUTE },
      { limit: 60, windowMs: HOUR },
    ])
);

/** Social-card renders that miss the image cache (CPU bound). */
export const ogRenderLimiter = singleton(
  "rate:og-render",
  () =>
    new SlidingWindowLimiter([
      { limit: 20, windowMs: MINUTE },
      { limit: 200, windowMs: HOUR },
    ])
);
