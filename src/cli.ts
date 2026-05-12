#!/usr/bin/env node
import { program } from 'commander';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { resolveTimeWindow, formatWeekLabel } from './time.js';
import { loadConfig, ensureConfigDir } from './config.js';
import { ClaudeCollector } from './collectors/claude.js';
import { KimiCollector } from './collectors/kimi.js';
import { buildSnapshot } from './engine/aggregator.js';
import { openDb, upsertSnapshot, getSnapshot } from './storage/db.js';
import { WeeklySnapshot } from './types.js';

const CONFIG_DIR = resolve(homedir(), '.cc-week-report');
const DB_PATH = resolve(CONFIG_DIR, 'cc-week.db');

program
  .name('cc-weekly')
  .description('AI dev weekly report')
  .option('--week <date>', 'Natural week starting Monday (e.g. 2026-05-04)')
  .option('--days <N>', 'Past N days', parseInt)
  .option('--json', 'Output raw snapshot JSON')
  .option('--force', 'Force re-collection, ignore cache')
  .action(async (opts) => {
    const config = loadConfig(CONFIG_DIR);
    const timeWindow = resolveTimeWindow(opts);
    const label = formatWeekLabel(timeWindow);

    let snapshot: WeeklySnapshot;

    // Check cache first
    if (!opts.force) {
      let db;
      try {
        db = openDb(DB_PATH);
        const cached = getSnapshot(db, timeWindow.start.toISOString().slice(0, 10), timeWindow.end.toISOString().slice(0, 10));
        if (cached) {
          snapshot = cached;
          if (opts.json) {
            console.log(JSON.stringify(snapshot, null, 2));
            return;
          }
          process.stdout.write(JSON.stringify(snapshot));
          if (db && db.open) db.close();
          return;
        }
      } finally {
        // db will be closed below after upsert or now
      }
    }

    // Collect
    const collectors = [new ClaudeCollector(), new KimiCollector()];
    const allSessions = (await Promise.all(
      collectors.map(c => c.collect(timeWindow.start, timeWindow.end, config))
    )).flat();

    snapshot = buildSnapshot(allSessions, {
      start: timeWindow.start.toISOString().slice(0, 10),
      end: timeWindow.end.toISOString().slice(0, 10),
    }, new Date());

    // Cache
    ensureConfigDir(CONFIG_DIR);
    const db = openDb(DB_PATH);
    try {
      upsertSnapshot(db, snapshot);
    } finally {
      if (db && db.open) db.close();
    }

    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      process.stdout.write(JSON.stringify(snapshot));
    }
  });

program.parse();
