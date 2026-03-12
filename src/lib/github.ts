import { Octokit } from "@octokit/rest";
import type {
  GitHubUser,
  GitHubRepo,
  GitHubCommitWeek,
  GitHubSearchItem,
  NormalizedData,
  RateLimitInfo,
} from "./types";

export function createOctokit(token?: string): Octokit {
  return new Octokit({ auth: token || undefined });
}

export async function fetchUserProfile(
  octokit: Octokit,
  username: string
): Promise<GitHubUser> {
  const { data } = await octokit.rest.users.getByUsername({ username });
  return data as unknown as GitHubUser;
}

export async function fetchUserRepos(
  octokit: Octokit,
  username: string
): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.repos.listForUser({
      username,
      per_page: 100,
      page,
      sort: "updated",
      direction: "desc",
    });
    allRepos.push(...(data as unknown as GitHubRepo[]));
    if (data.length < 100) break;
    page++;
  }
  return allRepos;
}

export async function fetchCommitActivity(
  octokit: Octokit,
  username: string,
  repos: GitHubRepo[]
): Promise<GitHubCommitWeek[]> {
  const now = Date.now();
  const topRepos = repos
    .filter((r) => !r.fork)
    .map((r) => {
      const pushedMs = r.pushed_at ? new Date(r.pushed_at).getTime() : 0;
      const recency = Math.max(0, 1 - (now - pushedMs) / (365 * 86400000));
      return { repo: r, score: r.stargazers_count + recency * 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const weeklyMap = new Map<number, GitHubCommitWeek>();

  const results = await Promise.allSettled(
    topRepos.map(async ({ repo }) => {
      try {
        const { data } = await octokit.rest.repos.getCommitActivityStats({
          owner: repo.full_name.split("/")[0],
          repo: repo.name,
        });
        if (!Array.isArray(data)) return [];
        return data as unknown as GitHubCommitWeek[];
      } catch {
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const week of result.value) {
      const existing = weeklyMap.get(week.week);
      if (existing) {
        existing.total += week.total;
        for (let i = 0; i < 7; i++) existing.days[i] += week.days[i];
      } else {
        weeklyMap.set(week.week, { total: week.total, week: week.week, days: [...week.days] });
      }
    }
  }

  return Array.from(weeklyMap.values()).sort((a, b) => a.week - b.week);
}

async function searchItems(
  octokit: Octokit,
  query: string,
  max = 300
): Promise<GitHubSearchItem[]> {
  const items: GitHubSearchItem[] = [];
  let page = 1;
  while (items.length < max) {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: query,
      per_page: Math.min(100, max - items.length),
      page,
      sort: "updated",
      order: "desc",
    });
    items.push(...(data.items as unknown as GitHubSearchItem[]));
    if (data.items.length < 100 || items.length >= max) break;
    page++;
  }
  return items.slice(0, max);
}

export async function fetchPullRequestsIssuesAndReviews(
  octokit: Octokit,
  username: string
): Promise<{ pullRequests: GitHubSearchItem[]; issues: GitHubSearchItem[]; reviews: GitHubSearchItem[] }> {
  const [pullRequests, issues, reviews] = await Promise.all([
    searchItems(octokit, `author:${username} type:pr`, 300),
    searchItems(octokit, `author:${username} type:issue`, 300),
    searchItems(octokit, `reviewed-by:${username} type:pr`, 200),
  ]);
  return { pullRequests, issues, reviews };
}

export async function getRateLimit(octokit: Octokit): Promise<RateLimitInfo> {
  try {
    const { data } = await octokit.rest.rateLimit.get();
    return {
      remaining: data.resources.core.remaining,
      limit: data.resources.core.limit,
      resetAt: new Date(data.resources.core.reset * 1000),
    };
  } catch {
    return { remaining: 0, limit: 60, resetAt: new Date(Date.now() + 3600000) };
  }
}

function extractRepo(url: string): string {
  const parts = url.split("/");
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

export function normalizeGitHubData(
  profile: GitHubUser,
  repos: GitHubRepo[],
  commitActivity: GitHubCommitWeek[],
  prs: GitHubSearchItem[],
  issues: GitHubSearchItem[],
  reviews: GitHubSearchItem[],
  username: string
): NormalizedData {
  return {
    profile: {
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      publicRepos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      createdAt: new Date(profile.created_at),
    },
    repos: repos.map((r) => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      createdAt: new Date(r.created_at),
      pushedAt: new Date(r.pushed_at || r.created_at),
      isFork: r.fork,
      topics: r.topics ?? [],
    })),
    commits: {
      weeklyData: commitActivity.map((w) => ({
        week: new Date(w.week * 1000),
        count: w.total,
      })),
      total: commitActivity.reduce((sum, w) => sum + w.total, 0),
    },
    pullRequests: prs.map((pr) => {
      const repo = extractRepo(pr.repository_url);
      const ownerMatch = repo.split("/")[0].toLowerCase();
      return {
        title: pr.title,
        state: pr.pull_request?.merged_at
          ? ("merged" as const)
          : pr.state === "closed"
            ? ("closed" as const)
            : ("open" as const),
        createdAt: new Date(pr.created_at),
        repo,
        isExternal: ownerMatch !== username.toLowerCase(),
      };
    }),
    issues: issues.map((issue) => {
      const repo = extractRepo(issue.repository_url);
      const ownerMatch = repo.split("/")[0].toLowerCase();
      return {
        title: issue.title,
        state: issue.state === "closed" ? ("closed" as const) : ("open" as const),
        createdAt: new Date(issue.created_at),
        repo,
        isExternal: ownerMatch !== username.toLowerCase(),
      };
    }),
    reviews: reviews.map((review) => ({
      title: review.title,
      createdAt: new Date(review.created_at),
      repo: extractRepo(review.repository_url),
    })),
  };
}

export async function fetchAllGitHubData(
  username: string,
  token?: string
): Promise<{ data: NormalizedData; rateLimit: RateLimitInfo }> {
  const octokit = createOctokit(token);

  const [profile, repos] = await Promise.all([
    fetchUserProfile(octokit, username),
    fetchUserRepos(octokit, username),
  ]);

  const [commitActivity, { pullRequests, issues, reviews }, rateLimit] = await Promise.all([
    fetchCommitActivity(octokit, username, repos),
    fetchPullRequestsIssuesAndReviews(octokit, username),
    getRateLimit(octokit),
  ]);

  const data = normalizeGitHubData(profile, repos, commitActivity, pullRequests, issues, reviews, username);
  return { data, rateLimit };
}
