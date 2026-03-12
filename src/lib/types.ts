// ============================================================
// GitHub API Raw Response Types
// ============================================================

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  pushed_at: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
}

export interface GitHubCommitWeek {
  total: number;
  week: number;
  days: number[];
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

export interface GitHubSearchItem {
  id: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  repository_url: string;
  pull_request?: {
    merged_at: string | null;
  };
}

// ============================================================
// Internal Normalized Data Model
// ============================================================

export interface NormalizedData {
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    publicRepos: number;
    followers: number;
    following: number;
    createdAt: Date;
  };
  repos: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    createdAt: Date;
    pushedAt: Date;
    isFork: boolean;
    topics: string[];
  }>;
  commits: {
    weeklyData: Array<{ week: Date; count: number }>;
    total: number;
  };
  pullRequests: Array<{
    title: string;
    state: "open" | "closed" | "merged";
    createdAt: Date;
    repo: string;
    isExternal: boolean;
  }>;
  issues: Array<{
    title: string;
    state: "open" | "closed";
    createdAt: Date;
    repo: string;
    isExternal: boolean;
  }>;
  reviews: Array<{
    title: string;
    createdAt: Date;
    repo: string;
  }>;
}

// ============================================================
// Scoring Types
// ============================================================

export interface CategoryScore {
  name: string;
  key: string;
  weight: number;
  score: number; // 0-100, -1 means N/A
  metrics: Record<string, number | string>;
}

export interface TitleInfo {
  title: string;
  description: string;
}

export interface ScoreBreakdown {
  overall: number;
  categories: CategoryScore[];
  title: TitleInfo;
  badges: string[];
  trend: Trend;
}

export type Trend = "improving" | "stable" | "declining";

// ============================================================
// Time Period Types
// ============================================================

export type TimePeriod = "30d" | "6m" | "1y" | "all";

export interface Evolution {
  periods: Record<TimePeriod, ScoreBreakdown>;
  trend: Trend;
}

// ============================================================
// Rate Limit
// ============================================================

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}
