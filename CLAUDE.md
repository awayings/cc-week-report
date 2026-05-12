# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm install                     # install dependencies
npm run build                   # tsc compile to dist/
npm test                        # vitest run (24 tests, 7 files)
npx vitest run tests/<path>     # single test file
npx tsc --noEmit                # type check only
npm run dev                     # tsx src/cli.ts (fast iteration)

bash scripts/collect-weekly.sh --days 7 --json  # run via bash wrapper
```

Global install:
```bash
npm install -g .
cc-weekly --days 7 --json       # CLI after global install
cc-weekly --force --json        # force re-collect
```

## Architecture

**Two-phase pipeline**: scripts collect → snapshot.json → skill renders via LLM.

```
Phase 1: Collectors (read-only local files) → Engine (12 metrics) → Aggregator → SQLite cache
Phase 2: /weekly-report skill reads snapshot → LLM per-project summary → chalk terminal report
```

### Source modules

- `src/types.ts` — all shared interfaces (SessionData, WeeklySnapshot, Tier123Metrics, AppConfig)
- `src/config.ts` — loads `~/.cc-week-report/config.yaml`, resolves project path → display name
- `src/time.ts` — time window: rolling N days (default 7), natural week (`--week`)
- `src/collectors/interface.ts` — `Collector` interface (pluggable: `name` + `collect()`)
- `src/collectors/claude.ts` — reads `~/.claude/usage-data/session-meta/*.json` + `facets/*.json`
- `src/collectors/kimi.ts` — reads `~/.kimi/sessions/<hash>/<sid>/wire.jsonl` + `state.json`
- `src/engine/metrics.ts` — `computeProjectMetrics()`: 12 indicators across 3 tiers
- `src/engine/aggregator.ts` — `buildSnapshot()`: groups sessions by project → WeeklySnapshot
- `src/storage/db.ts` — SQLite (WAL), idempotent `upsertSnapshot` / `getSnapshot` by date range
- `src/cli.ts` — commander entry: load config → time window → collectors → aggregate → cache → stdout JSON
- `skills/weekly-report.md` — Claude Code skill: runs script, LLM summaries, terminal report

### Data sources (read-only, zero network)

- **Claude**: `~/.claude/usage-data/session-meta/<uuid>.json` — session_id, project_path, input_tokens, output_tokens, duration_minutes, user_message_count, tool_counts, user_interruptions, tool_errors, user_message_timestamps
- **Claude**: `~/.claude/usage-data/facets/<uuid>.json` — outcome, brief_summary
- **Kimi**: `~/.kimi/sessions/<hash>/<sid>/wire.jsonl` — turn-by-turn events (TurnBegin, ToolCall, ContentPart)
- **Kimi**: `~/.kimi/sessions/<hash>/<sid>/state.json` — custom_title

### Key design decisions

- Snapshot JSON is the Phase 1 → Phase 2 data contract
- SQLite uses `ON CONFLICT DO UPDATE` for idempotent cache upserts
- Collectors accept custom directory paths via constructor (test fixtures override defaults)
- Error isolation: corrupt JSON files are skipped, not crashed
- Time zone: Asia/Shanghai for week labels and natural week computation
- Kimi sessions have `projectName: "unknown"` (no project path in Kimi data)
- Kimi sessions lack token data — token fields default to 0

## Tests

```
tests/
├── shared/
│   ├── time.test.ts          # time window resolution (4 tests)
│   └── config.test.ts        # config loading + project name (7 tests)
├── collectors/
│   ├── claude.test.ts        # Claude collector (4 tests)
│   └── kimi.test.ts          # Kimi collector (2 tests)
├── engine/
│   ├── metrics.test.ts       # 12 metrics computation (2 tests)
│   └── aggregator.test.ts    # snapshot building (2 tests)
└── storage/
    └── db.test.ts            # SQLite CRUD (3 tests)
```

Fixture directories simulate real data layouts:
- `tests/fixtures/claude/session-meta/` + `facets/` — flat JSON files per session UUID
- `tests/fixtures/kimi/sess-hash/sess-sid/` — nested hash/sid directory structure

## Config

User config at `~/.cc-week-report/config.yaml` (created automatically on first run):

```yaml
projects:
  "/Users/edy/projects/yj/risk-center": 风控中心
```

Simple YAML parser — only handles `key: value` under `projects:`. Not full YAML spec.
