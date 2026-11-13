#!/usr/bin/env node
// `next build` deletes .next/standalone/ — and with it the live leaderboard
// database, because the standalone server chdirs there and the default path
// is <cwd>/data/leaderboard.db (verified on Next 16.1.6 and 16.4.6, see
// docs/AUDITORIA.md P0-6).
//
// package.json runs this around every `npm run build`:
//   prebuild   node scripts/preserve-db.mjs save      snapshot into .db-backups/<timestamp>/
//   postbuild  node scripts/preserve-db.mjs restore   put it back if the build removed it
//
// No database file is ever overwritten or deleted: snapshots accumulate in
// .db-backups/ (git-ignored; prune them by hand). With DB_PATH set, the database lives
// outside .next and this script only reports that there is nothing to do.
// Stop the server before building: rows written by a server that is still
// running while the build happens are not in the snapshot.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const liveDir = path.join(root, ".next", "standalone", "data");
const liveDb = path.join(liveDir, "leaderboard.db");
const backupRoot = path.join(root, ".db-backups");
const latestFile = path.join(backupRoot, "LATEST");
const mode = process.argv[2];

const log = (message) => console.log(`[preserve-db] ${message}`);

function rowCount(file) {
  try {
    const Database = createRequire(import.meta.url)("better-sqlite3");
    const db = new Database(file, { readonly: true, fileMustExist: true });
    const { total } = db.prepare("SELECT COUNT(*) AS total FROM leaderboard").get();
    db.close();
    return total;
  } catch {
    return null;
  }
}

async function save() {
  if (process.env.DB_PATH) {
    log(`DB_PATH is set (${process.env.DB_PATH}): the database is outside .next, nothing to snapshot.`);
    return;
  }
  if (!fs.existsSync(liveDb)) {
    if (fs.existsSync(latestFile)) {
      // An earlier build removed the database and never got to restore it
      // (it failed half-way): keep the pointer so this build puts it back.
      log(`no live database; snapshot ${fs.readFileSync(latestFile, "utf8").trim()} will be restored after the build.`);
    } else {
      log("no database in .next/standalone/data yet, nothing to snapshot.");
    }
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(backupRoot, stamp);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "leaderboard.db");

  try {
    // Online backup: a consistent single file, WAL contents included
    const Database = createRequire(import.meta.url)("better-sqlite3");
    const db = new Database(liveDb, { readonly: true, fileMustExist: true });
    await db.backup(target);
    db.close();
  } catch (err) {
    // Fallback: raw copy of the file and its WAL/SHM sidecars
    log(`online backup failed (${err instanceof Error ? err.message : err}); copying files instead.`);
    for (const name of fs.readdirSync(liveDir)) {
      if (name.startsWith("leaderboard.db")) {
        fs.copyFileSync(path.join(liveDir, name), path.join(dir, name));
      }
    }
  }

  if (!fs.existsSync(target)) {
    throw new Error(`could not snapshot ${liveDb}`);
  }
  fs.writeFileSync(latestFile, stamp);
  const rows = rowCount(target);
  log(`snapshot saved to .db-backups/${stamp}/ (${rows ?? "?"} rows).`);
}

function restore() {
  if (process.env.DB_PATH) return;
  if (!fs.existsSync(latestFile)) return;
  const stamp = fs.readFileSync(latestFile, "utf8").trim();
  const dir = path.join(backupRoot, stamp);

  if (fs.existsSync(liveDb)) {
    log("the build kept .next/standalone/data/leaderboard.db; snapshot left untouched in .db-backups/.");
  } else {
    if (!fs.existsSync(path.join(dir, "leaderboard.db"))) {
      throw new Error(`snapshot .db-backups/${stamp}/leaderboard.db is missing`);
    }
    fs.mkdirSync(liveDir, { recursive: true });
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith("leaderboard.db")) {
        fs.copyFileSync(path.join(dir, name), path.join(liveDir, name), fs.constants.COPYFILE_EXCL);
      }
    }
    log(`database restored into .next/standalone/data/ (${rowCount(liveDb) ?? "?"} rows).`);
  }
  // Only now is the pointer obsolete (the snapshot itself stays)
  fs.rmSync(latestFile, { force: true });
}

try {
  if (mode === "save") await save();
  else if (mode === "restore") restore();
  else {
    console.error("usage: node scripts/preserve-db.mjs save|restore");
    process.exit(2);
  }
} catch (err) {
  console.error(`[preserve-db] ERROR: ${err instanceof Error ? err.message : err}`);
  console.error(
    "[preserve-db] The build was stopped to protect the leaderboard database. " +
      "Back it up by hand, or set SKIP_DB_BACKUP=1 to build anyway."
  );
  process.exit(process.env.SKIP_DB_BACKUP === "1" ? 0 : 1);
}
