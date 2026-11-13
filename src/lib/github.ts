import { createHash } from "crypto";
import type { NormalizedData, RateLimitInfo, TimePeriod, Trend } from "./types";
import type { ApiErrorCode } from "./api-errors";
import { calculateEvolution } from "./time-segmentation";
import { singleton } from "./singleton";

// ============================================================
// GraphQL queries
// ============================================================

const USER_QUERY = `
query($username: String!, $repoCursor: String, $prCursor: String, $issueCursor: String) {
  rateLimit {
    remaining
    limit
    resetAt
  }
  user(login: $username) {
    login
    name
    avatarUrl
    bio
    publicRepositories: repositories(privacy: PUBLIC) { totalCount }
    followers { totalCount }
    following { totalCount }
    createdAt
    contributionsCollection {
      totalCommitContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
    repositories(
      first: 100
      orderBy: { field: PUSHED_AT, direction: DESC }
      after: $repoCursor
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        description
        isFork
        stargazerCount
        forkCount
        createdAt
        pushedAt
        primaryLanguage { name }
        languages(first: 15) {
          edges { size node { name } }
        }
        repositoryTopics(first: 10) {
          nodes { topic { name } }
        }
      }
    }
    contributedRepos: repositoriesContributedTo(
      first: 50
      contributionTypes: [COMMIT, PULL_REQUEST]
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        name
        description
        isFork
        stargazerCount
        forkCount
        createdAt
        pushedAt
        primaryLanguage { name }
        languages(first: 15) {
          edges { size node { name } }
        }
        repositoryTopics(first: 10) {
          nodes { topic { name } }
        }
      }
    }
    pullRequests(
      first: 100
      orderBy: { field: UPDATED_AT, direction: DESC }
      after: $prCursor
    ) {
      pageInfo { hasNextPage endCursor }
      totalCount
      nodes {
        title
        state
        merged
        createdAt
        repository { nameWithOwner }
      }
    }
    issues(
      first: 100
      orderBy: { field: UPDATED_AT, direction: DESC }
      after: $issueCursor
    ) {
      pageInfo { hasNextPage endCursor }
      totalCount
      nodes {
        title
        state
        createdAt
        repository { nameWithOwner }
      }
    }
  }
}
`;

const PAGINATION_QUERY = `
query($username: String!, $repoCursor: String, $prCursor: String, $issueCursor: String) {
  rateLimit {
    remaining
    limit
    resetAt
  }
  user(login: $username) {
    repositories(
      first: 100
      orderBy: { field: PUSHED_AT, direction: DESC }
      after: $repoCursor
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        description
        isFork
        stargazerCount
        forkCount
        createdAt
        pushedAt
        primaryLanguage { name }
        languages(first: 15) {
          edges { size node { name } }
        }
        repositoryTopics(first: 10) {
          nodes { topic { name } }
        }
      }
    }
    pullRequests(
      first: 100
      orderBy: { field: UPDATED_AT, direction: DESC }
      after: $prCursor
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        state
        merged
        createdAt
        repository { nameWithOwner }
      }
    }
    issues(
      first: 100
      orderBy: { field: UPDATED_AT, direction: DESC }
      after: $issueCursor
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        state
        createdAt
        repository { nameWithOwner }
      }
    }
  }
}
`;

// ============================================================
// GraphQL response types
// ============================================================

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface GqlRepo {
  name: string;
  description: string | null;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  createdAt: string;
  pushedAt: string | null;
  primaryLanguage: { name: string } | null;
  languages: { edges: Array<{ size: number; node: { name: string } }> };
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
}

interface GqlPullRequest {
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  merged: boolean;
  createdAt: string;
  repository: { nameWithOwner: string };
}

interface GqlIssue {
  title: string;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  repository: { nameWithOwner: string };
}

interface GqlPagedUser {
  repositories: { pageInfo: PageInfo; nodes: GqlRepo[] };
  pullRequests: { pageInfo: PageInfo; totalCount?: number; nodes: GqlPullRequest[] };
  issues: { pageInfo: PageInfo; totalCount?: number; nodes: GqlIssue[] };
}

interface GqlUser extends GqlPagedUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  publicRepositories: { totalCount: number };
  followers: { totalCount: number };
  following: { totalCount: number };
  createdAt: string;
  contributionsCollection: {
    totalCommitContributions: number;
    totalPullRequestReviewContributions: number;
    contributionCalendar: {
      weeks: Array<{
        contributionDays: Array<{ contributionCount: number; date: string }>;
      }>;
    };
  };
  contributedRepos: { nodes: GqlRepo[] } | null;
}

interface UserQueryResponse {
  rateLimit: { remaining: number; limit: number; resetAt: string } | null;
  user: GqlUser | null;
}

interface PaginationQueryResponse {
  user: GqlPagedUser;
}

export interface GitHubDataResult {
  data: NormalizedData;
  rateLimit: RateLimitInfo;
}

// ============================================================
// Limits
// ============================================================

// Optional override (GitHub Enterprise, or a mock server in tests)
const GITHUB_GRAPHQL_URL = process.env.GITHUB_GRAPHQL_URL || "https://api.github.com/graphql";

// PRs / issues are paginated only until this many items have been collected
const MAX_PRS_AND_ISSUES = 200;
// Owned repos are paginated (most recently pushed first) only up to this many
const MAX_OWNED_REPOS = 300;
// Hard stop for the pagination loop, whatever the cursors say
const MAX_PAGINATION_CALLS = 4;

// One GraphQL call may take this long (GitHub itself gives up at ~10 s)...
const CALL_TIMEOUT_MS = 15_000;
// ...and the whole evaluation (first call + pagination) this long. Heavy
// profiles need 3 calls of ~8 s each; Cloudflare cuts the request at 100 s.
const TOTAL_DEADLINE_MS = 60_000;
const RETRY_DELAY_MS = 400;

// Stop calling GitHub when the token has fewer points than this left
const QUOTA_RESERVE = 100;

// Concurrent evaluations against GitHub (1 vCPU, 200 MB heap) and how many
// more may wait for a slot before we answer "busy"
const MAX_CONCURRENT_FETCHES = 3;
const MAX_WAITING_FETCHES = 10;

// ============================================================
// Typed errors
// ============================================================

export type GitHubErrorCode = Extract<
  ApiErrorCode,
  "not_found" | "quota_exhausted" | "busy" | "upstream" | "timeout" | "config"
>;

const PUBLIC_MESSAGES: Record<GitHubErrorCode, string> = {
  not_found: "GitHub user not found",
  quota_exhausted: "GitHub API quota exhausted, try again later",
  busy: "Too many evaluations in progress, try again in a few seconds",
  upstream: "GitHub API error, try again later",
  timeout: "GitHub API did not respond in time, try again later",
  config: "Service temporarily unavailable",
};

const HTTP_STATUS: Record<GitHubErrorCode, number> = {
  not_found: 404,
  quota_exhausted: 503,
  busy: 503,
  upstream: 502,
  timeout: 504,
  config: 503,
};

/**
 * Error thrown by this module. `message` is always one of PUBLIC_MESSAGES
 * (safe to send to clients); `detail` is for the server log only.
 */
export class GitHubError extends Error {
  readonly code: GitHubErrorCode;
  readonly status: number;
  readonly retryAfterSec?: number;
  readonly detail?: string;
  readonly retryable: boolean;

  constructor(
    code: GitHubErrorCode,
    options: { detail?: string; retryAfterSec?: number; retryable?: boolean } = {}
  ) {
    super(PUBLIC_MESSAGES[code]);
    this.name = "GitHubError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.detail = options.detail;
    this.retryAfterSec = options.retryAfterSec;
    this.retryable = options.retryable ?? false;
  }
}

export function toGitHubError(err: unknown): GitHubError {
  if (err instanceof GitHubError) return err;
  const name = err instanceof Error ? err.name : "";
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (name === "TimeoutError" || name === "AbortError") {
    return new GitHubError("timeout", { detail });
  }
  // fetch() rejects with TypeError on DNS/TCP/TLS failures
  return new GitHubError("upstream", { detail, retryable: true });
}

// ============================================================
// Process-wide state (cache, quota, concurrency)
// ============================================================

/** Small server-side digest of a profile (metadata, social card, leaderboard row). */
export interface ProfileSummary {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string; // ISO
  trend: Trend;
  periods: Record<TimePeriod, { overall: number; title: string }>;
  allTime: {
    overall: number;
    title: string;
    titleDescription: string;
    badges: string[];
    categories: Array<{ name: string; key: string; score: number }>;
  };
}

export interface ProfileEntry {
  /** Serialized API response: {"data":…,"rateLimit":…,"fetchedAt":…} (UTF-8) */
  body: Buffer;
  etag: string;
  summary: ProfileSummary;
  fetchedAt: number;
}

interface GitHubState {
  cache: Map<string, ProfileEntry>; // insertion order = LRU order
  cacheBytes: number;
  negative: Map<string, number>; // key -> expiry of a "not found" answer
  inFlight: Map<string, Promise<ProfileEntry>>;
  quota: { remaining: number; limit: number; resetAt: number } | null;
  blockedUntil: number; // secondary rate limit / Retry-After from GitHub
  activeFetches: number;
  waiters: Array<() => void>;
  upstreamCalls: number;
}

const state = singleton<GitHubState>("github", () => ({
  cache: new Map(),
  cacheBytes: 0,
  negative: new Map(),
  inFlight: new Map(),
  quota: null,
  blockedUntil: 0,
  activeFetches: 0,
  waiters: [],
  upstreamCalls: 0,
}));

function envInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// How long an entry is served without asking GitHub again
const CACHE_TTL_MS = envInt("GITHUB_CACHE_TTL_MS", 30 * 60_000);
// Expired entries are kept this long to be served if GitHub is failing
const STALE_IF_ERROR_MS = 24 * 3_600_000;
const NEGATIVE_TTL_MS = 10 * 60_000;
// Bodies are Buffers (outside the V8 heap): 30-60 KB per typical profile
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_NEGATIVE_ENTRIES = 2000;

// ============================================================
// GraphQL transport (native fetch, timeout, one short retry)
// ============================================================

interface GraphQLError {
  type?: string;
  message?: string;
  path?: Array<string | number>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQuotaHeaders(headers: Headers): void {
  const remaining = parseInt(headers.get("x-ratelimit-remaining") ?? "", 10);
  const limit = parseInt(headers.get("x-ratelimit-limit") ?? "", 10);
  const reset = parseInt(headers.get("x-ratelimit-reset") ?? "", 10);
  if (Number.isFinite(remaining) && Number.isFinite(reset)) {
    state.quota = {
      remaining,
      limit: Number.isFinite(limit) ? limit : 5000,
      resetAt: reset * 1000,
    };
  }
}

function secondsUntil(timestampMs: number): number {
  return Math.max(1, Math.ceil((timestampMs - Date.now()) / 1000));
}

/** Throws if we already know GitHub will refuse (or we want to keep a reserve). */
function assertQuotaAvailable(): void {
  const now = Date.now();
  if (state.blockedUntil > now) {
    throw new GitHubError("quota_exhausted", {
      detail: "blocked by a previous Retry-After",
      retryAfterSec: secondsUntil(state.blockedUntil),
    });
  }
  const quota = state.quota;
  if (quota && quota.resetAt > now && quota.remaining < QUOTA_RESERVE) {
    throw new GitHubError("quota_exhausted", {
      detail: `quota reserve reached (${quota.remaining}/${quota.limit})`,
      retryAfterSec: secondsUntil(quota.resetAt),
    });
  }
}

async function graphqlOnce<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  timeoutMs: number
): Promise<T> {
  state.upstreamCalls++;
  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "githubstars.iaen.es",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  readQuotaHeaders(res.headers);

  if (!res.ok) {
    // Never include the response body verbatim in public messages
    const text = (await res.text().catch(() => "")).slice(0, 300);
    const detail = `HTTP ${res.status}: ${text}`;
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);

    if (res.status === 401) throw new GitHubError("config", { detail });
    if (res.status === 403 || res.status === 429) {
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        state.blockedUntil = Date.now() + retryAfter * 1000;
        throw new GitHubError("quota_exhausted", { detail, retryAfterSec: retryAfter });
      }
      if (res.headers.get("x-ratelimit-remaining") === "0" && state.quota) {
        throw new GitHubError("quota_exhausted", {
          detail,
          retryAfterSec: secondsUntil(state.quota.resetAt),
        });
      }
      if (/rate limit|abuse/i.test(text)) {
        state.blockedUntil = Date.now() + 60_000;
        throw new GitHubError("quota_exhausted", { detail, retryAfterSec: 60 });
      }
      // Token without access (SSO, revoked scopes…)
      throw new GitHubError("config", { detail });
    }
    throw new GitHubError("upstream", { detail, retryable: res.status >= 500 });
  }

  let payload: { data?: (T & { user?: unknown }) | null; errors?: GraphQLError[] };
  try {
    payload = await res.json();
  } catch (err) {
    throw new GitHubError("upstream", {
      detail: `invalid JSON from GitHub: ${err instanceof Error ? err.message : err}`,
      retryable: true,
    });
  }

  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  if (errors.some((e) => e.type === "RATE_LIMITED")) {
    throw new GitHubError("quota_exhausted", {
      detail: "GraphQL RATE_LIMITED",
      retryAfterSec: state.quota ? secondsUntil(state.quota.resetAt) : 60,
    });
  }

  // The GraphQL rateLimit object and the HTTP headers do not always agree
  // (seen: 4929 in the body, 4970 in the headers of the next call). Keep the
  // lower figure so the reserve check errs on the safe side.
  const bodyLimit = (payload.data as { rateLimit?: UserQueryResponse["rateLimit"] } | null)
    ?.rateLimit;
  if (bodyLimit && Number.isFinite(bodyLimit.remaining)) {
    const resetAt = Date.parse(bodyLimit.resetAt);
    const fromHeaders = state.quota;
    state.quota = {
      remaining: Math.min(bodyLimit.remaining, fromHeaders?.remaining ?? Infinity),
      limit: bodyLimit.limit,
      resetAt: Number.isFinite(resetAt) ? resetAt : (fromHeaders?.resetAt ?? Date.now() + 3600000),
    };
  }

  const user = payload.data?.user;
  if (user == null) {
    const summary = errors.map((e) => `${e.type ?? "?"}: ${e.message ?? ""}`).join(" | ");
    const notFound =
      errors.length === 0 ||
      errors.some((e) => e.type === "NOT_FOUND" && (!e.path || e.path[0] === "user"));
    if (notFound) throw new GitHubError("not_found", { detail: summary });
    throw new GitHubError("upstream", { detail: summary.slice(0, 500) });
  }

  if (errors.length > 0) {
    // Partial data (e.g. repositories of organizations that restrict token
    // access): the profile is still evaluable, so keep what GitHub returned.
    const types = Array.from(new Set(errors.map((e) => e.type ?? "?"))).join(",");
    console.warn(`[github] partial data accepted (${errors.length} errors: ${types})`);
  }

  return payload.data as T;
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  deadlineAt: number
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const budget = deadlineAt - Date.now();
    if (budget < 500) throw new GitHubError("timeout", { detail: "total deadline exceeded" });
    try {
      return await graphqlOnce<T>(query, variables, token, Math.min(CALL_TIMEOUT_MS, budget));
    } catch (err) {
      const error = toGitHubError(err);
      const canRetry =
        attempt === 0 && error.retryable && deadlineAt - Date.now() > RETRY_DELAY_MS + 2000;
      if (!canRetry) throw error;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function compact<T>(items: Array<T | null | undefined> | null | undefined): T[] {
  return (items ?? []).filter((item): item is T => item != null);
}

// ============================================================
// Fetch + normalize (GitHub GraphQL API)
// ============================================================

export async function fetchAllGitHubData(
  username: string,
  token?: string
): Promise<GitHubDataResult> {
  if (!token) {
    throw new GitHubError("config", { detail: "GITHUB_TOKEN is not set" });
  }
  assertQuotaAvailable();

  const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;

  const first = await graphql<UserQueryResponse>(USER_QUERY, { username }, token, deadlineAt);
  const user = first.user;
  if (!user) throw new GitHubError("not_found");

  // Owned/collaborator repos first, then repos contributed to (deduped by name)
  const repoMap = new Map<string, GqlRepo>();
  const firstOwned = compact(user.repositories?.nodes);
  for (const repo of firstOwned) repoMap.set(repo.name, repo);
  for (const repo of compact(user.contributedRepos?.nodes)) {
    if (!repoMap.has(repo.name)) repoMap.set(repo.name, repo);
  }

  const repos = Array.from(repoMap.values());
  const pullRequests = compact(user.pullRequests?.nodes);
  const issues = compact(user.issues?.nodes);
  let ownedFetched = firstOwned.length;

  let repoCursor =
    user.repositories?.pageInfo.hasNextPage && ownedFetched < MAX_OWNED_REPOS
      ? user.repositories.pageInfo.endCursor
      : null;
  let prCursor =
    user.pullRequests?.pageInfo.hasNextPage && pullRequests.length < MAX_PRS_AND_ISSUES
      ? user.pullRequests.pageInfo.endCursor
      : null;
  let issueCursor =
    user.issues?.pageInfo.hasNextPage && issues.length < MAX_PRS_AND_ISSUES
      ? user.issues.pageInfo.endCursor
      : null;

  let paginationCalls = 0;
  while ((repoCursor || prCursor || issueCursor) && paginationCalls < MAX_PAGINATION_CALLS) {
    paginationCalls++;
    const page = (
      await graphql<PaginationQueryResponse>(
        PAGINATION_QUERY,
        { username, repoCursor, prCursor, issueCursor },
        token,
        deadlineAt
      )
    ).user;

    if (repoCursor) {
      const nodes = compact(page.repositories?.nodes);
      repos.push(...nodes);
      ownedFetched += nodes.length;
      repoCursor =
        page.repositories?.pageInfo.hasNextPage && ownedFetched < MAX_OWNED_REPOS
          ? page.repositories.pageInfo.endCursor
          : null;
    }
    if (prCursor) {
      pullRequests.push(...compact(page.pullRequests?.nodes));
      prCursor =
        page.pullRequests?.pageInfo.hasNextPage && pullRequests.length < MAX_PRS_AND_ISSUES
          ? page.pullRequests.pageInfo.endCursor
          : null;
    }
    if (issueCursor) {
      issues.push(...compact(page.issues?.nodes));
      issueCursor =
        page.issues?.pageInfo.hasNextPage && issues.length < MAX_PRS_AND_ISSUES
          ? page.issues.pageInfo.endCursor
          : null;
    }
  }

  const contributions = user.contributionsCollection;
  const weeklyData = compact(contributions?.contributionCalendar?.weeks)
    .filter((week) => week.contributionDays?.length > 0)
    .map((week) => {
      const days = week.contributionDays;
      const count = days.reduce((sum, d) => sum + d.contributionCount, 0);
      return { week: new Date(days[0].date), count };
    });

  const lowerUsername = username.toLowerCase();

  const data: NormalizedData = {
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      publicRepos: user.publicRepositories?.totalCount ?? 0,
      followers: user.followers?.totalCount ?? 0,
      following: user.following?.totalCount ?? 0,
      createdAt: new Date(user.createdAt),
    },
    repos: repos.map((r) => {
      const edges = compact(r.languages?.edges).filter((edge) => edge.node);
      const languageBytes: Record<string, number> = {};
      for (const edge of edges) {
        languageBytes[edge.node.name] = (languageBytes[edge.node.name] || 0) + edge.size;
      }
      return {
        name: r.name,
        description: r.description,
        language: r.primaryLanguage?.name ?? null,
        languages: edges.map((edge) => edge.node.name),
        languageBytes,
        stars: r.stargazerCount,
        forks: r.forkCount,
        createdAt: new Date(r.createdAt),
        pushedAt: new Date(r.pushedAt || r.createdAt),
        isFork: r.isFork,
        topics: compact(r.repositoryTopics?.nodes)
          .filter((n) => n.topic)
          .map((n) => n.topic.name),
      };
    }),
    commits: {
      weeklyData,
      total: contributions?.totalCommitContributions ?? 0,
    },
    pullRequests: pullRequests
      .filter((pr) => pr.repository)
      .map((pr) => {
        const owner = pr.repository.nameWithOwner.split("/")[0].toLowerCase();
        return {
          title: pr.title,
          state: pr.merged
            ? ("merged" as const)
            : pr.state === "CLOSED"
              ? ("closed" as const)
              : ("open" as const),
          createdAt: new Date(pr.createdAt),
          repo: pr.repository.nameWithOwner,
          isExternal: owner !== lowerUsername,
        };
      }),
    issues: issues
      .filter((issue) => issue.repository)
      .map((issue) => {
        const owner = issue.repository.nameWithOwner.split("/")[0].toLowerCase();
        return {
          title: issue.title,
          state: issue.state === "CLOSED" ? ("closed" as const) : ("open" as const),
          createdAt: new Date(issue.createdAt),
          repo: issue.repository.nameWithOwner,
          isExternal: owner !== lowerUsername,
        };
      }),
    // The API only exposes the review count for the last year, not each review
    reviews: Array.from(
      { length: contributions?.totalPullRequestReviewContributions ?? 0 },
      (_, i) => ({
        title: `review-${i}`,
        createdAt: new Date(),
        repo: "",
      })
    ),
  };

  const rateLimit: RateLimitInfo = first.rateLimit
    ? {
        remaining: first.rateLimit.remaining,
        limit: first.rateLimit.limit,
        resetAt: new Date(first.rateLimit.resetAt),
      }
    : { remaining: 0, limit: 5000, resetAt: new Date(Date.now() + 3600000) };

  return { data, rateLimit };
}

// ============================================================
// Cache: LRU + TTL + negative cache + stale-if-error + in-flight dedupe
// ============================================================

function summarize(data: NormalizedData): ProfileSummary {
  const evolution = calculateEvolution(data);
  const allTime = evolution.periods.all;
  const pick = (period: TimePeriod) => ({
    overall: evolution.periods[period].overall,
    title: evolution.periods[period].title.title,
  });
  return {
    login: data.profile.login,
    name: data.profile.name,
    avatarUrl: data.profile.avatarUrl,
    createdAt: data.profile.createdAt.toISOString(),
    trend: evolution.trend,
    periods: { "30d": pick("30d"), "6m": pick("6m"), "1y": pick("1y"), all: pick("all") },
    allTime: {
      overall: allTime.overall,
      title: allTime.title.title,
      titleDescription: allTime.title.description,
      badges: allTime.badges,
      categories: allTime.categories.map((c) => ({ name: c.name, key: c.key, score: c.score })),
    },
  };
}

function cacheDelete(key: string): void {
  const existing = state.cache.get(key);
  if (!existing) return;
  state.cacheBytes -= existing.body.length;
  state.cache.delete(key);
}

function cacheSet(key: string, entry: ProfileEntry): void {
  cacheDelete(key);
  if (entry.body.length > MAX_ENTRY_BYTES) return; // served, but too big to keep

  const now = Date.now();
  for (const [k, e] of state.cache) {
    if (now - e.fetchedAt > STALE_IF_ERROR_MS) cacheDelete(k);
  }

  state.cache.set(key, entry);
  state.cacheBytes += entry.body.length;

  while (state.cache.size > MAX_CACHE_ENTRIES || state.cacheBytes > MAX_CACHE_BYTES) {
    const oldest = state.cache.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    cacheDelete(oldest);
  }
}

/** Marks `key` as most recently used. */
function cacheTouch(key: string, entry: ProfileEntry): void {
  state.cache.delete(key);
  state.cache.set(key, entry);
}

function isFresh(entry: ProfileEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < CACHE_TTL_MS;
}

function isUsableStale(entry: ProfileEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < STALE_IF_ERROR_MS;
}

function isKnownMissing(key: string, now = Date.now()): boolean {
  const until = state.negative.get(key);
  if (until === undefined) return false;
  if (until > now) return true;
  state.negative.delete(key);
  return false;
}

function rememberMissing(key: string): void {
  state.negative.delete(key);
  state.negative.set(key, Date.now() + NEGATIVE_TTL_MS);
  while (state.negative.size > MAX_NEGATIVE_ENTRIES) {
    const oldest = state.negative.keys().next().value;
    if (oldest === undefined) break;
    state.negative.delete(oldest);
  }
}

async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (state.activeFetches >= MAX_CONCURRENT_FETCHES) {
    if (state.waiters.length >= MAX_WAITING_FETCHES) {
      throw new GitHubError("busy", { retryAfterSec: 5 });
    }
    // The finishing task hands its slot over, so activeFetches stays put
    await new Promise<void>((resolve) => state.waiters.push(resolve));
  } else {
    state.activeFetches++;
  }
  try {
    return await task();
  } finally {
    const next = state.waiters.shift();
    if (next) next();
    else state.activeFetches--;
  }
}

async function fetchAndStore(key: string, username: string): Promise<ProfileEntry> {
  const startedAt = Date.now();
  const callsBefore = state.upstreamCalls;
  try {
    const entry = await withFetchSlot(async () => {
      const result = await fetchAllGitHubData(username, process.env.GITHUB_TOKEN || undefined);
      const fetchedAt = Date.now();
      const body = Buffer.from(
        JSON.stringify({
          data: result.data,
          rateLimit: result.rateLimit,
          fetchedAt: new Date(fetchedAt).toISOString(),
        }),
        "utf8"
      );
      const etag = `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`;
      return { body, etag, summary: summarize(result.data), fetchedAt } satisfies ProfileEntry;
    });
    state.negative.delete(key);
    cacheSet(key, entry);
    console.log(
      `[github] fetched ${key}: ${state.upstreamCalls - callsBefore} call(s), ` +
        `${Date.now() - startedAt} ms, ${entry.body.length} bytes, ` +
        `quota ${state.quota ? `${state.quota.remaining}/${state.quota.limit}` : "?"}, ` +
        `cache ${state.cache.size} entries / ${Math.round(state.cacheBytes / 1024)} KB`
    );
    return entry;
  } catch (err) {
    const error = toGitHubError(err);
    if (error.code === "not_found") {
      rememberMissing(key);
      cacheDelete(key);
    }
    // The detail may quote GitHub's answer; it never contains the token
    console.warn(
      `[github] ${key} failed: ${error.code}` + (error.detail ? ` (${error.detail})` : "")
    );
    throw error;
  }
}

export type CacheStatus = "HIT" | "MISS" | "STALE";

export interface ProfileResult {
  entry: ProfileEntry;
  cache: CacheStatus;
}

export type ProfilePeek =
  | { kind: "hit"; entry: ProfileEntry }
  | { kind: "not_found" }
  | { kind: "pending" }
  | { kind: "miss"; stale?: ProfileEntry };

/** What would loadProfile() do right now? Never calls GitHub. */
export function peekProfile(username: string): ProfilePeek {
  const key = username.toLowerCase();
  const now = Date.now();
  const entry = state.cache.get(key);
  if (entry && isFresh(entry, now)) return { kind: "hit", entry };
  if (isKnownMissing(key, now)) return { kind: "not_found" };
  if (state.inFlight.has(key)) return { kind: "pending" };
  return { kind: "miss", stale: entry && isUsableStale(entry, now) ? entry : undefined };
}

/**
 * Cached profile, fetching from GitHub when needed. Concurrent callers for the
 * same user share one upstream request. If GitHub fails and an expired copy
 * younger than 24 h exists, that copy is returned (cache: "STALE").
 */
export async function loadProfile(username: string): Promise<ProfileResult> {
  const key = username.toLowerCase();
  const cached = state.cache.get(key);
  if (cached && isFresh(cached)) {
    cacheTouch(key, cached);
    return { entry: cached, cache: "HIT" };
  }
  if (isKnownMissing(key)) throw new GitHubError("not_found", { detail: "negative cache" });

  let pending = state.inFlight.get(key);
  if (!pending) {
    pending = fetchAndStore(key, username);
    state.inFlight.set(key, pending);
    const clear = () => {
      if (state.inFlight.get(key) === pending) state.inFlight.delete(key);
    };
    pending.then(clear, clear);
  }

  try {
    return { entry: await pending, cache: "MISS" };
  } catch (err) {
    const error = toGitHubError(err);
    const stale = state.cache.get(key);
    if (error.code !== "not_found" && stale && isUsableStale(stale)) {
      return { entry: stale, cache: "STALE" };
    }
    throw error;
  }
}

/** Digest of a cached profile (fresh or stale). Never calls GitHub. */
export function getCachedSummary(username: string): ProfileSummary | null {
  const entry = state.cache.get(username.toLowerCase());
  return entry && isUsableStale(entry) ? entry.summary : null;
}

/** True when GitHub is known to have no such user (recent 404). Never calls GitHub. */
export function isKnownMissingUser(username: string): boolean {
  return isKnownMissing(username.toLowerCase());
}
