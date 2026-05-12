import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, upsertSnapshot, getSnapshot } from '../../src/storage/db.js';
import { WeeklySnapshot } from '../../src/types.js';
import Database from 'better-sqlite3';

const testDbPath = resolve('/tmp/cc-week-report-test-db', 'cc-week.db');

function makeSnapshot(): WeeklySnapshot {
  return {
    week: '2026-05-05 ~ 2026-05-12',
    range: { start: '2026-05-05', end: '2026-05-12' },
    generatedAt: '2026-05-12T15:30:00.000Z',
    global: {
      totalSessions: 2, totalTokens: { input: 1000, output: 500 },
      estimatedCost: 0.01, inputOutputRatio: 2.0, avgSessionDurationMin: 30,
      cacheHitRate: 0.5, avgToolCallsPerResponse: 2.0, completionRate: 1.0, toolErrorRate: 0,
    },
    projects: [],
  };
}

describe('SQLite storage', () => {
  let db: Database.Database;

  beforeEach(() => {
    rmSync('/tmp/cc-week-report-test-db', { recursive: true, force: true });
    db = openDb(testDbPath);
  });

  afterEach(() => {
    if (db && db.open) db.close();
  });

  it('upserts and retrieves a snapshot', () => {
    const snap = makeSnapshot();
    upsertSnapshot(db, snap);
    const retrieved = getSnapshot(db, '2026-05-05', '2026-05-12');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.global.totalSessions).toBe(2);
  });

  it('returns null for missing snapshot', () => {
    const retrieved = getSnapshot(db, '2026-01-01', '2026-01-07');
    expect(retrieved).toBeNull();
  });

  it('upsert is idempotent', () => {
    const snap = makeSnapshot();
    upsertSnapshot(db, snap);
    upsertSnapshot(db, snap);
    const retrieved = getSnapshot(db, '2026-05-05', '2026-05-12');
    expect(retrieved!.global.totalSessions).toBe(2);
  });
});
