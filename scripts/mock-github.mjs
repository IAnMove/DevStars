#!/usr/bin/env node
// Minimal stand-in for GitHub's GraphQL API, for load and failure tests that
// must not spend real quota. Start it, then run the app with
//   GITHUB_TOKEN=fake GITHUB_GRAPHQL_URL=http://127.0.0.1:4010/graphql
//
// Behaviour is chosen by the prefix of the requested login:
//   nf-*       GraphQL NOT_FOUND
//   err-*      HTTP 502 on every call
//   once-*     first evaluation works, later ones answer HTTP 502 (stale-if-error)
//   rl-*       HTTP 403 + Retry-After: 30 (secondary rate limit)
//   low-*      works, but reports x-ratelimit-remaining: 50 (quota reserve)
//   slow-*     answers after 20 s (client timeout)
//   partial-*  data plus an "errors" array and null nodes
//   big-*      350 repositories over 4 pages, 250 PRs, 250 issues
//   anything else: an ordinary profile (~45 KB once normalised)
// GET /__calls returns how many GraphQL calls each login has received.

import http from "node:http";

const PORT = parseInt(process.env.MOCK_PORT || "4010", 10);
const calls = new Map();
let remaining = 5000;

const LANGS = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "C", "Shell", "HTML", "CSS"];

function repo(i, login) {
  return {
    name: `${login}-repo-${i}`,
    description: `Repository number ${i} of ${login} with a reasonably long description`,
    isFork: i % 7 === 0,
    stargazerCount: (i * 37) % 900,
    forkCount: (i * 11) % 90,
    createdAt: new Date(Date.UTC(2015 + (i % 10), i % 12, 1 + (i % 27))).toISOString(),
    pushedAt: new Date(Date.now() - i * 3 * 86400000).toISOString(),
    primaryLanguage: { name: LANGS[i % LANGS.length] },
    languages: {
      edges: LANGS.slice(0, 1 + (i % LANGS.length)).map((name, k) => ({
        size: 1000 * (k + 1) * (i + 1),
        node: { name },
      })),
    },
    repositoryTopics: { nodes: [{ topic: { name: "topic-a" } }, { topic: { name: "topic-b" } }] },
  };
}

function pr(i, login) {
  return {
    title: `Pull request ${i}: improve something important`,
    state: i % 5 === 0 ? "OPEN" : "MERGED",
    merged: i % 5 !== 0,
    createdAt: new Date(Date.now() - i * 5 * 86400000).toISOString(),
    repository: { nameWithOwner: `${i % 3 === 0 ? "someorg" : login}/project-${i % 9}` },
  };
}

function issue(i, login) {
  return {
    title: `Issue ${i}: something does not work`,
    state: i % 2 === 0 ? "CLOSED" : "OPEN",
    createdAt: new Date(Date.now() - i * 9 * 86400000).toISOString(),
    repository: { nameWithOwner: `${i % 2 === 0 ? "someorg" : login}/project-${i % 9}` },
  };
}

function page(total, cursor, make, login) {
  const start = cursor ? parseInt(cursor, 10) : 0;
  const end = Math.min(start + 100, total);
  const nodes = [];
  for (let i = start; i < end; i++) nodes.push(make(i, login));
  return { pageInfo: { hasNextPage: end < total, endCursor: String(end) }, totalCount: total, nodes };
}

function weeks() {
  const out = [];
  for (let w = 52; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - (w * 7 + (6 - d)) * 86400000).toISOString().slice(0, 10);
      days.push({ contributionCount: (w + d) % 4, date });
    }
    out.push({ contributionDays: days });
  }
  return out;
}

function buildUser(login, variables, isFirst) {
  const big = login.startsWith("big-");
  const repos = big ? 350 : 60;
  const prs = big ? 250 : 80;
  const issues = big ? 250 : 30;
  const user = {
    repositories: page(repos, variables.repoCursor, repo, login),
    pullRequests: page(prs, variables.prCursor, pr, login),
    issues: page(issues, variables.issueCursor, issue, login),
  };
  if (!isFirst) return user;
  return {
    login,
    name: `Mock ${login}`,
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    bio: "Mock profile",
    publicRepositories: { totalCount: repos },
    followers: { totalCount: 10 },
    following: { totalCount: 5 },
    createdAt: "2016-01-01T00:00:00Z",
    contributionsCollection: {
      totalCommitContributions: 420,
      totalPullRequestReviewContributions: 120,
      contributionCalendar: { weeks: weeks() },
    },
    contributedRepos: { nodes: [repo(900, "other"), repo(901, "other")] },
    ...user,
  };
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__calls") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(Object.fromEntries(calls)));
    return;
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const variables = body.variables || {};
    const login = String(variables.username || "");
    const isFirst = String(body.query).includes("contributionsCollection");
    const count = (calls.get(login) || 0) + 1;
    calls.set(login, count);
    remaining = Math.max(0, remaining - 1);

    const headers = {
      "Content-Type": "application/json",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": String(login.startsWith("low-") ? 50 : remaining),
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 20),
      "x-ratelimit-resource": "graphql",
    };
    const send = (status, payload, extra = {}) => {
      res.writeHead(status, { ...headers, ...extra });
      res.end(JSON.stringify(payload));
    };

    if (login.startsWith("nf-")) {
      send(200, {
        data: { user: null },
        errors: [
          {
            type: "NOT_FOUND",
            path: ["user"],
            message: `Could not resolve to a User with the login of '${login}'.`,
          },
        ],
      });
      return;
    }
    if (login.startsWith("err-") || (login.startsWith("once-") && count > 1)) {
      send(502, { message: "Bad gateway (mock) with internal detail /srv/secret" });
      return;
    }
    if (login.startsWith("rl-")) {
      send(
        403,
        { message: "You have exceeded a secondary rate limit (mock)." },
        { "retry-after": "30" }
      );
      return;
    }

    const user = buildUser(login, variables, isFirst);
    const data = {
      rateLimit: {
        remaining: login.startsWith("low-") ? 50 : remaining,
        limit: 5000,
        resetAt: new Date(Date.now() + 20000).toISOString(),
      },
      user,
    };
    let payload = { data };
    if (login.startsWith("partial-")) {
      user.repositories.nodes[3] = null;
      user.pullRequests.nodes[1] = null;
      payload = {
        data,
        errors: [
          {
            type: "FORBIDDEN",
            path: ["user", "repositories", "nodes", 3],
            message: "Resource protected by organization SAML enforcement.",
          },
        ],
      };
    }

    if (login.startsWith("slow-")) setTimeout(() => send(200, payload), 20000);
    else setTimeout(() => send(200, payload), 30);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock GitHub GraphQL listening on http://127.0.0.1:${PORT}/graphql`);
});
