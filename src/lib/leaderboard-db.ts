import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { singleton } from "./singleton";

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

// Bump only for backwards-compatible changes (indexes, ADD COLUMN … DEFAULT).
// Older builds of the app ignore user_version and keep working on the file.
const SCHEMA_VERSION = 1;

// Stable ranking order: score, then who got there first, then name
const RANK_ORDER = "overall_score DESC, evaluated_at ASC, username ASC";

const holder = singleton<{ db: Database.Database | null; exitHook: boolean }>(
  "leaderboard-db",
  () => ({ db: null, exitHook: false })
);

export function getDbPath(): string {
  // Note: the standalone server chdirs into .next/standalone, so in production
  // the default path is .next/standalone/data/leaderboard.db, and `next build`
  // wipes that folder (see docs/AUDITORIA.md, P0-6). DB_PATH avoids it.
  return process.env.DB_PATH || path.join(process.cwd(), "data", "leaderboard.db");
}

function migrate(db: Database.Database): void {
  // Same statement production has always run: no-op on an existing file
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

  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < 1) {
    // v1: indexes only. Idempotent, touches no rows.
    db.transaction(() => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_leaderboard_rank
          ON leaderboard (overall_score DESC, evaluated_at ASC, username ASC);
        CREATE INDEX IF NOT EXISTS idx_leaderboard_username_nocase
          ON leaderboard (username COLLATE NOCASE);
      `);
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
  }
}

function getDb(): Database.Database {
  if (!holder.db) {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    migrate(db);
    holder.db = db;
    checkpoint();

    if (!holder.exitHook) {
      holder.exitHook = true;
      // Next's own SIGTERM/SIGINT handler ends with process.exit(), which
      // fires this hook: fold the WAL into the main file and close cleanly.
      process.once("exit", closeDb);
    }
  }
  return holder.db;
}

export function closeDb(): void {
  const db = holder.db;
  if (!db) return;
  checkpoint();
  holder.db = null;
  try {
    db.close();
  } catch {
    // nothing else to do at exit
  }
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
  checkpoint();
}

/**
 * Folds the WAL into the main file. Writes are rare (one per saved profile),
 * so doing it after each one keeps leaderboard.db complete on its own: a
 * backup that copies only the .db file, or a process killed with SIGKILL,
 * loses nothing.
 */
function checkpoint(): void {
  try {
    holder.db?.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // busy reader: SQLite will checkpoint later on its own
  }
}

export function getTopEntries(limit = 100): LeaderboardEntry[] {
  return getDb()
    .prepare(`SELECT * FROM leaderboard ORDER BY ${RANK_ORDER} LIMIT ?`)
    .all(limit) as LeaderboardEntry[];
}

/** Case-insensitive lookup (GitHub logins are case-insensitive). */
export function getByUsername(username: string): LeaderboardEntry | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM leaderboard WHERE username = ? COLLATE NOCASE ORDER BY evaluated_at DESC LIMIT 1"
    )
    .get(username) as LeaderboardEntry | undefined;
}

/** 1-based position of a row in the ranking order used by getTopEntries(). */
export function getRank(entry: LeaderboardEntry): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS ahead FROM leaderboard
       WHERE overall_score > @score
          OR (overall_score = @score AND evaluated_at < @at)
          OR (overall_score = @score AND evaluated_at = @at AND username < @username)`
    )
    .get({
      score: entry.overall_score,
      at: entry.evaluated_at,
      username: entry.username,
    }) as { ahead: number };
  return row.ahead + 1;
}

export function countEntries(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS total FROM leaderboard").get() as {
    total: number;
  };
  return row.total;
}

/** Minimal projection for the sitemap (best first, capped). */
export function getSitemapEntries(
  limit = 5000
): Array<{ username: string; evaluated_at: string }> {
  return getDb()
    .prepare(`SELECT username, evaluated_at FROM leaderboard ORDER BY ${RANK_ORDER} LIMIT ?`)
    .all(limit) as Array<{ username: string; evaluated_at: string }>;
}

const RECENT_HOURS = 24;

export function isRecent(entry: LeaderboardEntry, hours = RECENT_HOURS): boolean {
  return new Date(entry.evaluated_at).getTime() > Date.now() - hours * 3600000;
}

export function isRecentlyEvaluated(username: string, hours = RECENT_HOURS): boolean {
  const entry = getByUsername(username);
  return entry ? isRecent(entry, hours) : false;
}

/** Same as getByUsername() but never throws (pages must render without the DB). */
export function findEntrySafe(username: string): LeaderboardEntry | undefined {
  try {
    return getByUsername(username);
  } catch (err) {
    console.error("[leaderboard-db] lookup failed:", err instanceof Error ? err.message : err);
    return undefined;
  }
}
