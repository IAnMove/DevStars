import { Octokit } from "@octokit/rest";
import type { NormalizedData, RateLimitInfo } from "./types";

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

// PRs / issues are paginated only until this many items have been collected
const MAX_PRS_AND_ISSUES = 200;

// ============================================================
// Fetch + normalize (GitHub GraphQL API)
// ============================================================

export async function fetchAllGitHubData(
  username: string,
  token?: string
): Promise<GitHubDataResult> {
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is required. GraphQL API does not work without authentication."
    );
  }

  const octokit = new Octokit({ auth: token });

  const first = await octokit.graphql<UserQueryResponse>(USER_QUERY, { username });
  const user = first.user;
  if (!user) throw new Error("User not found");

  // Owned/collaborator repos first, then repos contributed to (deduped by name)
  const repoMap = new Map<string, GqlRepo>();
  for (const repo of user.repositories.nodes) repoMap.set(repo.name, repo);
  if (user.contributedRepos) {
    for (const repo of user.contributedRepos.nodes) {
      if (!repoMap.has(repo.name)) repoMap.set(repo.name, repo);
    }
  }

  const repos = Array.from(repoMap.values());
  const pullRequests = [...user.pullRequests.nodes];
  const issues = [...user.issues.nodes];

  let repoCursor = user.repositories.pageInfo.hasNextPage
    ? user.repositories.pageInfo.endCursor
    : null;
  let prCursor =
    user.pullRequests.pageInfo.hasNextPage && pullRequests.length < MAX_PRS_AND_ISSUES
      ? user.pullRequests.pageInfo.endCursor
      : null;
  let issueCursor =
    user.issues.pageInfo.hasNextPage && issues.length < MAX_PRS_AND_ISSUES
      ? user.issues.pageInfo.endCursor
      : null;

  while (repoCursor || prCursor || issueCursor) {
    const page = (
      await octokit.graphql<PaginationQueryResponse>(PAGINATION_QUERY, {
        username,
        repoCursor,
        prCursor,
        issueCursor,
      })
    ).user;

    if (repoCursor) {
      repos.push(...page.repositories.nodes);
      repoCursor = page.repositories.pageInfo.hasNextPage
        ? page.repositories.pageInfo.endCursor
        : null;
    }
    if (prCursor) {
      pullRequests.push(...page.pullRequests.nodes);
      prCursor =
        page.pullRequests.pageInfo.hasNextPage && pullRequests.length < MAX_PRS_AND_ISSUES
          ? page.pullRequests.pageInfo.endCursor
          : null;
    }
    if (issueCursor) {
      issues.push(...page.issues.nodes);
      issueCursor =
        page.issues.pageInfo.hasNextPage && issues.length < MAX_PRS_AND_ISSUES
          ? page.issues.pageInfo.endCursor
          : null;
    }
  }

  const contributions = user.contributionsCollection;
  const weeklyData = contributions.contributionCalendar.weeks.map((week) => {
    const days = week.contributionDays;
    const count = days.reduce((sum, d) => sum + d.contributionCount, 0);
    return { week: new Date(days[0].date), count };
  });

  const data: NormalizedData = {
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      publicRepos: user.publicRepositories.totalCount,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      createdAt: new Date(user.createdAt),
    },
    repos: repos.map((r) => {
      const languageBytes: Record<string, number> = {};
      for (const edge of r.languages.edges) {
        languageBytes[edge.node.name] = (languageBytes[edge.node.name] || 0) + edge.size;
      }
      return {
        name: r.name,
        description: r.description,
        language: r.primaryLanguage?.name ?? null,
        languages: r.languages.edges.map((edge) => edge.node.name),
        languageBytes,
        stars: r.stargazerCount,
        forks: r.forkCount,
        createdAt: new Date(r.createdAt),
        pushedAt: new Date(r.pushedAt || r.createdAt),
        isFork: r.isFork,
        topics: r.repositoryTopics.nodes.map((n) => n.topic.name),
      };
    }),
    commits: {
      weeklyData,
      total: contributions.totalCommitContributions,
    },
    pullRequests: pullRequests.map((pr) => {
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
        isExternal: owner !== username.toLowerCase(),
      };
    }),
    issues: issues.map((issue) => {
      const owner = issue.repository.nameWithOwner.split("/")[0].toLowerCase();
      return {
        title: issue.title,
        state: issue.state === "CLOSED" ? ("closed" as const) : ("open" as const),
        createdAt: new Date(issue.createdAt),
        repo: issue.repository.nameWithOwner,
        isExternal: owner !== username.toLowerCase(),
      };
    }),
    // The API only exposes the review count for the last year, not each review
    reviews: Array.from(
      { length: contributions.totalPullRequestReviewContributions },
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
// In-memory cache + in-flight de-duplication + rate-limit retry
// ============================================================

interface CacheEntry extends GitHubDataResult {
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();
const CACHE_TTL_MS = parseInt(process.env.GITHUB_CACHE_TTL_MS || "1800000", 10);
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WAIT_MS = 60000;
const CLEANUP_INTERVAL_MS = 300000;

export async function fetchGitHubDataCached(
  username: string,
  token?: string
): Promise<GitHubDataResult> {
  const key = username.toLowerCase();

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { data: cached.data, rateLimit: cached.rateLimit };
  }

  const pending = inFlight.get(key);
  if (pending) {
    const entry = await pending;
    return { data: entry.data, rateLimit: entry.rateLimit };
  }

  const request = fetchWithRetry(username, token, key);
  inFlight.set(key, request);
  try {
    const entry = await request;
    return { data: entry.data, rateLimit: entry.rateLimit };
  } finally {
    inFlight.delete(key);
  }
}

async function fetchWithRetry(
  username: string,
  token: string | undefined,
  key: string
): Promise<CacheEntry> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fetchAllGitHubData(username, token);
      const entry: CacheEntry = {
        data: result.data,
        rateLimit: result.rateLimit,
        timestamp: Date.now(),
      };
      cache.set(key, entry);
      return entry;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const message = lastError.message.toLowerCase();
      const isRateLimited =
        message.includes("rate limit") ||
        message.includes("api rate") ||
        message.includes("secondary rate") ||
        message.includes("403") ||
        message.includes("429");

      if (isRateLimited && attempt < MAX_ATTEMPTS - 1) {
        console.log(
          `Rate limited for ${username}, waiting 60s (attempt ${attempt + 1}/${MAX_ATTEMPTS})`
        );
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Failed to fetch GitHub data");
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) cache.delete(key);
  }
}

setInterval(cleanupCache, CLEANUP_INTERVAL_MS);
