import Database from 'better-sqlite3';
import { WeeklySnapshot } from '../types.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_snapshots (
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (week_start, week_end)
    );
  `);

  return db;
}

export function upsertSnapshot(db: Database.Database, snapshot: WeeklySnapshot): void {
  const stmt = db.prepare(`
    INSERT INTO weekly_snapshots (week_start, week_end, snapshot_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(week_start, week_end) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = datetime('now')
  `);
  stmt.run(snapshot.range.start, snapshot.range.end, JSON.stringify(snapshot));
}

export function getSnapshot(db: Database.Database, start: string, end: string): WeeklySnapshot | null {
  const stmt = db.prepare(`
    SELECT snapshot_json FROM weekly_snapshots WHERE week_start = ? AND week_end = ?
  `);
  const row = stmt.get(start, end) as { snapshot_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.snapshot_json) as WeeklySnapshot;
}
