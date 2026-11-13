import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * A row of the `leaderboard` table.
 * `badges` and `categories` are stored (and returned by the API) as JSON strings.
 */
export interface LeaderboardEntry {
  username: string;
  avatar_url: string;
  name: string | null;
  overall_score: number;
  title: string;
  title_description: string;
  badges: string; // JSON string: string[]
  categories: string; // JSON string: Array<{ name, key, score }>
  trend: string;
  evaluated_at: string; // ISO date
  github_created_at: string; // ISO date
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // Note: the standalone server chdirs into .next/standalone, so in production
    // the live database is .next/standalone/data/leaderboard.db
    const dbPath =
      process.env.DB_PATH || path.join(process.cwd(), "data", "leaderboard.db");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        username TEXT PRIMARY KEY,
        avatar_url TEXT NOT NULL,
        name TEXT,
        overall_score INTEGER NOT NULL,
        title TEXT NOT NULL,
        title_description TEXT NOT NULL DEFAULT '',
        badges TEXT NOT NULL DEFAULT '[]',
        categories TEXT NOT NULL DEFAULT '[]',
        trend TEXT NOT NULL DEFAULT 'stable',
        evaluated_at TEXT NOT NULL,
        github_created_at TEXT NOT NULL
      )
    `);
  }
  return db;
}

export function upsertEntry(entry: LeaderboardEntry): void {
  getDb()
    .prepare(
      `
    INSERT INTO leaderboard (username, avatar_url, name, overall_score, title, title_description, badges, categories, trend, evaluated_at, github_created_at)
    VALUES (@username, @avatar_url, @name, @overall_score, @title, @title_description, @badges, @categories, @trend, @evaluated_at, @github_created_at)
    ON CONFLICT(username) DO UPDATE SET
      avatar_url = @avatar_url,
      name = @name,
      overall_score = @overall_score,
      title = @title,
      title_description = @title_description,
      badges = @badges,
      categories = @categories,
      trend = @trend,
      evaluated_at = @evaluated_at,
      github_created_at = @github_created_at
  `
    )
    .run(entry);
}

export function getTopEntries(limit = 100): LeaderboardEntry[] {
  return getDb()
    .prepare("SELECT * FROM leaderboard ORDER BY overall_score DESC LIMIT ?")
    .all(limit) as LeaderboardEntry[];
}

export function getByUsername(username: string): LeaderboardEntry | undefined {
  return getDb()
    .prepare("SELECT * FROM leaderboard WHERE username = ?")
    .get(username) as LeaderboardEntry | undefined;
}

export function isRecentlyEvaluated(username: string, hours = 24): boolean {
  const entry = getByUsername(username);
  if (!entry) return false;
  return new Date(entry.evaluated_at).getTime() > Date.now() - hours * 3600000;
}
