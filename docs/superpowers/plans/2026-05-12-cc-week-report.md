# cc-week-report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid AI dev weekly report tool — TypeScript scripts collect/aggregate session data from Claude Code and Kimi CLI, a Claude Code skill (`/weekly-report`) renders the report with LLM summarization.

**Architecture:** Two-phase pipeline. Phase 1 (scripts): collectors read local session files → metrics engine computes 12 indicators → aggregator produces `snapshot.json`. Phase 2 (skill): Claude Code reads snapshot → LLM summarizes per-project → chalk terminal report.

**Tech Stack:** TypeScript, Node.js >=22, better-sqlite3, chalk, commander, dayjs, vitest.

---

## File Structure

```
cc-week-report/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── config.default.yaml
├── scripts/
│   └── collect-weekly.sh          # Bash entry point
├── skills/
│   └── weekly-report.md           # Claude Code skill file
├── src/
│   ├── cli.ts                     # standalone CLI (commander)
│   ├── types.ts                   # all shared types & interfaces
│   ├── config.ts                  # ~/.cc-week-report/config.yaml loader
│   ├── time.ts                    # time window resolution
│   ├── collectors/
│   │   ├── interface.ts           # Collector interface
│   │   ├── claude.ts              # ClaudeCollector
│   │   └── kimi.ts                # KimiCollector
│   ├── engine/
│   │   ├── metrics.ts             # 12-metric calculator
│   │   └── aggregator.ts          # group by project → snapshot
│   └── storage/
│       └── db.ts                  # SQLite cache
├── tests/
│   ├── fixtures/
│   │   ├── claude/                # mock Claude session-meta + facets
│   │   └── kimi/                  # mock Kimi state + wire + context
│   ├── collectors/
│   │   ├── claude.test.ts
│   │   └── kimi.test.ts
│   ├── engine/
│   │   ├── metrics.test.ts
│   │   └── aggregator.test.ts
│   ├── storage/
│   │   └── db.test.ts
│   └── shared/
│       ├── config.test.ts
│       └── time.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `config.default.yaml`
- Create: `src/types.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "cc-week-report",
  "version": "0.1.0",
  "description": "AI dev weekly report — session analytics from Claude Code & Kimi CLI",
  "type": "module",
  "main": "dist/cli.js",
  "bin": { "cc-weekly": "./dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.4.0",
    "commander": "^13.0.0",
    "dayjs": "^1.11.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "engines": { "node": ">=22" }
}
```

- [ ] **Step 2: Install dependencies and verify**

```bash
cd /Users/edy/projects/me/tech/cc-week-report && npm install
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests", "dist", "node_modules"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write `config.default.yaml`**

```yaml
# project path → display name mapping
# unmatched projects show as "unknown"
projects: {}
```

- [ ] **Step 6: Write `src/types.ts`**

```typescript
export interface TokenUsage {
  input: number;
  output: number;
  cacheCreation?: number;
  cacheRead?: number;
}

export interface SessionData {
  sessionId: string;
  projectPath: string;
  projectName: string;
  toolName: 'claude' | 'kimi';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  userMessageCount: number;
  assistantMessageCount: number;
  totalToolCalls: number;
  toolErrors: number;
  tokens: TokenUsage;
  summary: string;
  outcome: string | null;
  userMessageTimestamps: string[];
  interruptions: number;
  autonomousMs: number;
}

export interface Tier1Metrics {
  inputFrequencyPerHour: number;
  avgInteractionMin: number;
  avgAutonomousMin: number;
  interruptionRate: number;
}

export interface Tier2Metrics {
  avgInputTokensPerMsg: number;
  avgOutputTokensPerMsg: number;
  inputOutputRatio: number;
}

export interface Tier3Metrics {
  cacheHitRate: number;
  toolCallDensity: number;
  completionRate: number;
  estimatedCost: number;
  toolErrorRate: number;
}

export interface ProjectSnapshot {
  name: string;
  path: string;
  sessionCount: number;
  totalTokens: { input: number; output: number };
  tier1: Tier1Metrics;
  tier2: Tier2Metrics;
  tier3: Tier3Metrics;
  summaries: string[];
}

export interface WeeklySnapshot {
  week: string;
  range: { start: string; end: string };
  generatedAt: string;
  global: {
    totalSessions: number;
    totalTokens: { input: number; output: number };
    estimatedCost: number;
    inputOutputRatio: number;
    avgSessionDurationMin: number;
    cacheHitRate: number;
    avgToolCallsPerResponse: number;
    completionRate: number;
    toolErrorRate: number;
  };
  projects: ProjectSnapshot[];
}

export interface AppConfig {
  projects: Record<string, string>;
}

export interface Collector {
  name: string;
  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]>;
}
```

- [ ] **Step 7: Run `npx tsc --noEmit` to verify types compile**

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts config.default.yaml src/types.ts
git commit -m "feat: project scaffolding with types and config"
```

---

### Task 2: Time Window Resolution

**Files:**
- Create: `src/time.ts`
- Create: `tests/shared/time.test.ts`

- [ ] **Step 1: Write the failing test `tests/shared/time.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveTimeWindow } from '../../src/time.js';

describe('resolveTimeWindow', () => {
  it('defaults to past 7 days', () => {
    const now = new Date('2026-05-12T15:30:00Z');
    const result = resolveTimeWindow({}, now);
    expect(result.start.toISOString()).toBe('2026-05-05T15:30:00.000Z');
    expect(result.end.toISOString()).toBe('2026-05-12T15:30:00.000Z');
  });

  it('accepts --days N', () => {
    const now = new Date('2026-05-12T15:30:00Z');
    const result = resolveTimeWindow({ days: 3 }, now);
    expect(result.start.toISOString()).toBe('2026-05-09T15:30:00.000Z');
  });

  it('accepts --week for natural week (Mon 00:00 ~ Sun 23:59)', () => {
    // 2026-05-04 is a Monday
    const result = resolveTimeWindow({ week: '2026-05-04' });
    expect(result.start.toISOString()).toBe('2026-05-04T00:00:00.000+08:00');
    expect(result.end.toISOString()).toBe('2026-05-10T23:59:59.999+08:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/shared/time.test.ts
```
Expected: FAIL — `resolveTimeWindow` not defined.

- [ ] **Step 3: Write `src/time.ts`**

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface TimeWindowOptions {
  days?: number;
  week?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export function resolveTimeWindow(opts: TimeWindowOptions, now: Date = new Date()): TimeWindow {
  if (opts.week) {
    const monday = dayjs(opts.week).tz('Asia/Shanghai').startOf('day');
    const sunday = monday.add(6, 'day').endOf('day');
    return { start: monday.toDate(), end: sunday.toDate() };
  }
  const days = opts.days ?? 7;
  return {
    start: dayjs(now).subtract(days, 'day').toDate(),
    end: now,
  };
}

export function formatWeekLabel(range: TimeWindow): string {
  const fmt = 'YYYY-MM-DD';
  return `${dayjs(range.start).format(fmt)} ~ ${dayjs(range.end).format(fmt)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/shared/time.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/time.ts tests/shared/time.test.ts
git commit -m "feat: time window resolution with rolling N days and natural week"
```

---

### Task 3: Config Loader

**Files:**
- Create: `src/config.ts`
- Create: `tests/shared/config.test.ts`

The config file lives at `~/.cc-week-report/config.yaml`. It maps project paths to display names:
```yaml
projects:
  "/Users/edy/projects/yj/risk-center": "风控中心"
```

- [ ] **Step 1: Write the failing test `tests/shared/config.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../../src/config.js';

const testDir = resolve('/tmp/cc-week-report-test-config');

describe('loadConfig', () => {
  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  it('returns empty projects map when no config exists', () => {
    const cfg = loadConfig(testDir);
    expect(cfg.projects).toEqual({});
  });

  it('reads project mapping from config.yaml', () => {
    writeFileSync(resolve(testDir, 'config.yaml'), `
projects:
  /Users/edy/projects/yj/risk-center: 风控中心
  /Users/edy/projects/me/tech/cc-week-report: 周报工具
`);
    const cfg = loadConfig(testDir);
    expect(cfg.projects['/Users/edy/projects/yj/risk-center']).toBe('风控中心');
    expect(cfg.projects['/Users/edy/projects/me/tech/cc-week-report']).toBe('周报工具');
  });

  it('resolves project name from config or derives from path', () => {
    writeFileSync(resolve(testDir, 'config.yaml'), `
projects: {}
`);
    const cfg = loadConfig(testDir);
    const name = cfg.projects['/Users/edy/projects/yj/risk-center'] ?? 'unknown';
    expect(name).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run test — expected FAIL**

```bash
npx vitest run tests/shared/config.test.ts
```

- [ ] **Step 3: Write `src/config.ts`**

```typescript
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig } from './types.js';

export function ensureConfigDir(configDir: string): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

export function loadConfig(configDir: string): AppConfig {
  const configPath = resolve(configDir, 'config.yaml');
  if (!existsSync(configPath)) {
    return { projects: {} };
  }
  const raw = readFileSync(configPath, 'utf-8');
  return parseSimpleYaml(raw);
}

function parseSimpleYaml(raw: string): AppConfig {
  const projects: Record<string, string> = {};
  let inProjects = false;
  for (const line of raw.split('\n')) {
    if (line.trim() === 'projects:') { inProjects = true; continue; }
    if (!inProjects) continue;
    const match = line.match(/^\s+(.+?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      projects[key] = val;
    }
  }
  return { projects };
}

export function resolveProjectName(path: string, config: AppConfig): string {
  return config.projects[path] ?? path.split('/').pop() ?? 'unknown';
}
```

- [ ] **Step 4: Run test — expected PASS**

```bash
npx vitest run tests/shared/config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/shared/config.test.ts
git commit -m "feat: config loader for project path → name mapping"
```

---

### Task 4: Claude Collector

**Files:**
- Create: `src/collectors/interface.ts`
- Create: `src/collectors/claude.ts`
- Create: `tests/fixtures/claude/session-meta/sess-1.json`
- Create: `tests/fixtures/claude/facets/sess-1.json`
- Create: `tests/collectors/claude.test.ts`

- [ ] **Step 1: Write `src/collectors/interface.ts`**

```typescript
import { SessionData, AppConfig } from '../types.js';

export interface Collector {
  readonly name: string;
  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]>;
}
```

- [ ] **Step 2: Write test fixtures**

`tests/fixtures/claude/session-meta/sess-1.json`:
```json
{
  "session_id": "sess-1",
  "project_path": "/Users/edy/projects/yj/risk-center",
  "start_time": "2026-05-08T02:00:00.000Z",
  "duration_minutes": 45,
  "user_message_count": 8,
  "assistant_message_count": 35,
  "tool_counts": { "Read": 5, "Edit": 10, "Bash": 3 },
  "input_tokens": 120000,
  "output_tokens": 45000,
  "first_prompt": "重构风控规则引擎",
  "user_interruptions": 2,
  "user_response_times": [],
  "tool_errors": 1,
  "tool_error_categories": { "Command Failed": 1 },
  "user_message_timestamps": [
    "2026-05-08T02:00:00.000Z",
    "2026-05-08T02:05:00.000Z",
    "2026-05-08T02:12:00.000Z",
    "2026-05-08T02:18:00.000Z",
    "2026-05-08T02:25:00.000Z",
    "2026-05-08T02:32:00.000Z",
    "2026-05-08T02:38:00.000Z",
    "2026-05-08T02:45:00.000Z"
  ]
}
```

`tests/fixtures/claude/facets/sess-1.json`:
```json
{
  "underlying_goal": "重构风控规则引擎，将硬编码规则迁移到 DSL 表达式",
  "goal_categories": { "refactor": 1 },
  "outcome": "completed",
  "brief_summary": "重构 RuleMatchExecutor 类，新增 DslRuleParser，全部测试通过",
  "session_id": "sess-1"
}
```

- [ ] **Step 3: Write the failing test `tests/collectors/claude.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { ClaudeCollector } from '../../src/collectors/claude.js';
import { resolve } from 'node:path';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'claude');

describe('ClaudeCollector', () => {
  it('parses session-meta into SessionData', async () => {
    const collector = new ClaudeCollector(fixturesDir);
    const start = new Date('2026-05-05');
    const end = new Date('2026-05-13');
    const sessions = await collector.collect(start, end, { projects: {} });

    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.sessionId).toBe('sess-1');
    expect(s.projectPath).toBe('/Users/edy/projects/yj/risk-center');
    expect(s.projectName).toBe('risk-center');
    expect(s.toolName).toBe('claude');
    expect(s.durationMinutes).toBe(45);
    expect(s.userMessageCount).toBe(8);
    expect(s.assistantMessageCount).toBe(35);
    expect(s.tokens.input).toBe(120000);
    expect(s.tokens.output).toBe(45000);
    expect(s.summary).toBe('重构 RuleMatchExecutor 类，新增 DslRuleParser，全部测试通过');
    expect(s.outcome).toBe('completed');
    expect(s.interruptions).toBe(2);
    expect(s.totalToolCalls).toBe(18);
    expect(s.toolErrors).toBe(1);
    expect(s.userMessageTimestamps).toHaveLength(8);
  });

  it('filters sessions outside time window', async () => {
    const collector = new ClaudeCollector(fixturesDir);
    const start = new Date('2026-06-01');
    const end = new Date('2026-06-07');
    const sessions = await collector.collect(start, end, { projects: {} });
    expect(sessions).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run test — expected FAIL**

```bash
npx vitest run tests/collectors/claude.test.ts
```

- [ ] **Step 5: Write `src/collectors/claude.ts`**

```typescript
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Collector } from './interface.js';
import { SessionData, AppConfig } from '../types.js';
import { resolveProjectName } from '../config.js';

interface SessionMeta {
  session_id: string;
  project_path: string;
  start_time: string;
  duration_minutes: number;
  user_message_count: number;
  assistant_message_count: number;
  tool_counts: Record<string, number>;
  input_tokens: number;
  output_tokens: number;
  user_interruptions: number;
  tool_errors: number;
  user_message_timestamps: string[];
}

interface FacetData {
  outcome?: string;
  brief_summary?: string;
  session_id: string;
}

export class ClaudeCollector implements Collector {
  readonly name = 'claude';

  constructor(private usageDataDir: string = resolve(process.env.HOME ?? '~', '.claude', 'usage-data')) {}

  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    const metaDir = resolve(this.usageDataDir, 'session-meta');
    const facetsDir = resolve(this.usageDataDir, 'facets');

    if (!existsSync(metaDir)) return Promise.resolve(sessions);

    for (const file of readdirSync(metaDir)) {
      if (!file.endsWith('.json')) continue;
      const meta = JSON.parse(readFileSync(resolve(metaDir, file), 'utf-8')) as SessionMeta;
      const startTime = new Date(meta.start_time);
      if (startTime < start || startTime > end) continue;

      const totalToolCalls = Object.values(meta.tool_counts).reduce((a, b) => a + b, 0);
      let summary = '';
      let outcome: string | null = null;

      const facetPath = resolve(facetsDir, `${meta.session_id}.json`);
      if (existsSync(facetPath)) {
        const facet = JSON.parse(readFileSync(facetPath, 'utf-8')) as FacetData;
        summary = facet.brief_summary ?? '';
        outcome = facet.outcome ?? null;
      }

      sessions.push({
        sessionId: meta.session_id,
        projectPath: meta.project_path,
        projectName: resolveProjectName(meta.project_path, config),
        toolName: 'claude',
        startTime: meta.start_time,
        endTime: new Date(startTime.getTime() + meta.duration_minutes * 60000).toISOString(),
        durationMinutes: meta.duration_minutes,
        userMessageCount: meta.user_message_count,
        assistantMessageCount: meta.assistant_message_count,
        totalToolCalls,
        toolErrors: meta.tool_errors,
        tokens: { input: meta.input_tokens, output: meta.output_tokens },
        summary,
        outcome,
        userMessageTimestamps: meta.user_message_timestamps,
        interruptions: meta.user_interruptions,
        autonomousMs: this.estimateAutonomousMs(meta.user_message_timestamps, meta.duration_minutes),
      });
    }
    return Promise.resolve(sessions);
  }

  private estimateAutonomousMs(timestamps: string[], durationMin: number): number {
    if (timestamps.length < 2) return durationMin * 60 * 1000;
    let gaps = 0;
    for (let i = 1; i < timestamps.length; i++) {
      gaps += new Date(timestamps[i]).getTime() - new Date(timestamps[i - 1]).getTime();
    }
    return gaps;
  }
}
```

- [ ] **Step 6: Run test — expected PASS**

```bash
npx vitest run tests/collectors/claude.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/collectors/interface.ts src/collectors/claude.ts tests/fixtures/claude/ tests/collectors/claude.test.ts
git commit -m "feat: Claude Code collector with session-meta + facets parsing"
```

---

### Task 5: Kimi Collector

**Files:**
- Create: `src/collectors/kimi.ts`
- Create: `tests/fixtures/kimi/sess-hash/sess-sid/state.json`
- Create: `tests/fixtures/kimi/sess-hash/sess-sid/wire.jsonl`
- Create: `tests/fixtures/kimi/sess-hash/sess-sid/context.jsonl`
- Create: `tests/collectors/kimi.test.ts`

- [ ] **Step 1: Write test fixtures**

`tests/fixtures/kimi/sess-hash/sess-sid/state.json`:
```json
{
  "version": 1,
  "custom_title": "重构风控规则引擎"
}
```

`tests/fixtures/kimi/sess-hash/sess-sid/wire.jsonl`:
```
{"type":"metadata","protocol_version":"1.9"}
{"timestamp":1776310348.01877,"message":{"type":"TurnBegin","payload":{"user_input":"重构风控规则引擎"}}}
{"timestamp":1776310348.01958,"message":{"type":"StepBegin","payload":{"n":1}}}
{"timestamp":1776310353.11973,"message":{"type":"ContentPart","payload":{"type":"think","think":"分析需求..."}}}
{"timestamp":1776310353.83698,"message":{"type":"ToolCall","payload":{"type":"function","id":"tool_1","function":{"name":"ReadFile","arguments":"{}"}}}}
{"timestamp":1776310360.0,"message":{"type":"ToolCall","payload":{"type":"function","id":"tool_2","function":{"name":"WriteFile","arguments":"{}"}}}}
{"timestamp":1776310453.0,"message":{"type":"StepBegin","payload":{"n":2}}}
{"timestamp":1776310653.0,"message":{"type":"ContentPart","payload":{"type":"think","think":"继续..."}}}
{"timestamp":1776310753.0,"message":{"type":"ToolCall","payload":{"type":"function","id":"tool_3","function":{"name":"Shell","arguments":"{}"}}}}
{"timestamp":1776310953.0,"message":{"type":"TurnBegin","payload":{"user_input":"不对，换个方案"}}}
{"timestamp":1776311000.0,"message":{"type":"ToolCall","payload":{"type":"function","id":"tool_4","function":{"name":"Shell","arguments":"{}"}}}}
```

`tests/fixtures/kimi/sess-hash/sess-sid/context.jsonl`:
```
{"role":"user","content":"重构风控规则引擎，将硬编码规则迁移到 DSL 表达式"}
{"role":"assistant","content":"好的，我来分析现有代码结构..."}
```

- [ ] **Step 2: Write the failing test `tests/collectors/kimi.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { KimiCollector } from '../../src/collectors/kimi.js';
import { resolve } from 'node:path';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures', 'kimi');

describe('KimiCollector', () => {
  it('parses wire.jsonl into SessionData', async () => {
    const collector = new KimiCollector(fixturesDir);
    const start = new Date('2026-04-01');
    const end = new Date('2026-05-01');
    const sessions = await collector.collect(start, end, { projects: {} });

    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.sessionId).toBe('sess-hash/sess-sid');
    expect(s.toolName).toBe('kimi');
    expect(s.userMessageCount).toBe(2);       // 2 TurnBegin
    expect(s.totalToolCalls).toBe(4);          // 4 ToolCall
    expect(s.summary).toBe('重构风控规则引擎');
    expect(s.interruptions).toBe(0);           // no error/correction signals in fixtures
    expect(s.durationMinutes).toBeGreaterThan(0);
  });

  it('filters sessions outside time window', async () => {
    const collector = new KimiCollector(fixturesDir);
    const sessions = await collector.collect(new Date('2025-01-01'), new Date('2025-01-02'), { projects: {} });
    expect(sessions).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test — expected FAIL**

```bash
npx vitest run tests/collectors/kimi.test.ts
```

- [ ] **Step 4: Write `src/collectors/kimi.ts`**

```typescript
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Collector } from './interface.js';
import { SessionData, AppConfig } from '../types.js';

interface WireEvent {
  type: string;
  timestamp: number;
  message?: {
    type: string;
    payload: {
      user_input?: string;
      type?: string;
      id?: string;
      think?: string;
      function?: { name: string; arguments: string };
    };
  };
}

const CORRECTION_SIGNALS = ['不对', '错了', '换个思路', '换个方案', '重新', 'no', 'wrong'];

export class KimiCollector implements Collector {
  readonly name = 'kimi';

  constructor(private sessionsDir: string = resolve(process.env.HOME ?? '~', '.kimi', 'sessions')) {}

  collect(start: Date, end: Date, config: AppConfig): Promise<SessionData[]> {
    const sessions: SessionData[] = [];

    if (!existsSync(this.sessionsDir)) return Promise.resolve(sessions);

    for (const hashDir of readdirSync(this.sessionsDir)) {
      const hashPath = resolve(this.sessionsDir, hashDir);
      if (!statSync(hashPath).isDirectory()) continue;

      for (const sidDir of readdirSync(hashPath)) {
        const sidPath = resolve(hashPath, sidDir);
        if (!statSync(sidPath).isDirectory()) continue;

        const wirePath = resolve(sidPath, 'wire.jsonl');
        if (!existsSync(wirePath)) continue;

        const wireLines = readFileSync(wirePath, 'utf-8').trim().split('\n');
        const events: WireEvent[] = wireLines.map(l => JSON.parse(l));

        const timestamps = events.filter(e => e.timestamp).map(e => e.timestamp * 1000);
        if (timestamps.length === 0) continue;

        const sessionStart = new Date(timestamps[0]);
        const sessionEnd = new Date(timestamps[timestamps.length - 1]);

        if (sessionEnd < start || sessionStart > end) continue;

        const userTurns = events.filter(e => e.message?.type === 'TurnBegin');
        const toolCalls = events.filter(e => e.message?.type === 'ToolCall');
        const userMsgs = userTurns.map(t => t.message!.payload.user_input ?? '');
        const firstUserMsg = userMsgs[0] ?? '';

        const interruptions = userMsgs.filter(m =>
          CORRECTION_SIGNALS.some(sig => m.includes(sig))
        ).length;

        // Estimate autonomous time from tool call gaps
        const toolTimestamps = toolCalls.map(t => t.timestamp * 1000);
        let autonomousMs = 0;
        for (let i = 1; i < toolTimestamps.length; i++) {
          const gap = toolTimestamps[i] - toolTimestamps[i - 1];
          if (gap < 300000) autonomousMs += gap; // gap < 5min = continuous
        }

        const durationMs = sessionEnd.getTime() - sessionStart.getTime();

        // Try to get project path from context or state
        let projectPath = 'unknown';
        let summary = firstUserMsg.slice(0, 200);

        const statePath = resolve(sidPath, 'state.json');
        if (existsSync(statePath)) {
          const state = JSON.parse(readFileSync(statePath, 'utf-8'));
          if (state.custom_title) summary = state.custom_title;
        }

        sessions.push({
          sessionId: `${hashDir}/${sidDir}`,
          projectPath,
          projectName: 'unknown',
          toolName: 'kimi',
          startTime: sessionStart.toISOString(),
          endTime: sessionEnd.toISOString(),
          durationMinutes: Math.round(durationMs / 60000),
          userMessageCount: userTurns.length,
          assistantMessageCount: events.filter(e => e.message?.type === 'ContentPart').length,
          totalToolCalls: toolCalls.length,
          toolErrors: 0, // Kimi wire.jsonl doesn't expose tool errors directly
          tokens: { input: 0, output: 0 }, // Kimi doesn't expose token counts in wire
          summary,
          outcome: null,
          userMessageTimestamps: userTurns.map(t => new Date(t.timestamp * 1000).toISOString()),
          interruptions,
          autonomousMs,
        });
      }
    }
    return Promise.resolve(sessions);
  }
}
```

- [ ] **Step 5: Run test — expected PASS**

```bash
npx vitest run tests/collectors/kimi.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/collectors/kimi.ts tests/fixtures/kimi/ tests/collectors/kimi.test.ts
git commit -m "feat: Kimi CLI collector with wire.jsonl parsing"
```

---

### Task 6: Metrics Engine

**Files:**
- Create: `src/engine/metrics.ts`
- Create: `tests/engine/metrics.test.ts`

- [ ] **Step 1: Write the failing test `tests/engine/metrics.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { computeProjectMetrics } from '../../src/engine/metrics.js';
import { SessionData } from '../../src/types.js';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'sess-1',
    projectPath: '/tmp/test',
    projectName: 'test',
    toolName: 'claude',
    startTime: '2026-05-08T02:00:00.000Z',
    endTime: '2026-05-08T02:45:00.000Z',
    durationMinutes: 45,
    userMessageCount: 8,
    assistantMessageCount: 35,
    totalToolCalls: 18,
    toolErrors: 1,
    tokens: { input: 120000, output: 45000 },
    summary: 'test summary',
    outcome: 'completed',
    userMessageTimestamps: [
      '2026-05-08T02:00:00.000Z',
      '2026-05-08T02:05:00.000Z',
      '2026-05-08T02:12:00.000Z',
      '2026-05-08T02:18:00.000Z',
      '2026-05-08T02:25:00.000Z',
      '2026-05-08T02:32:00.000Z',
      '2026-05-08T02:38:00.000Z',
      '2026-05-08T02:45:00.000Z',
    ],
    interruptions: 2,
    autonomousMs: 1800000,
    ...overrides,
  };
}

describe('computeProjectMetrics', () => {
  it('computes all 12 metrics for a list of sessions', () => {
    const sessions = [
      makeSession(),
      makeSession({
        sessionId: 'sess-2',
        durationMinutes: 30,
        tokens: { input: 80000, output: 35000 },
        outcome: 'mostly_achieved',
        interruptions: 1,
        autonomousMs: 900000,
      }),
    ];

    const m = computeProjectMetrics(sessions);

    // Tier 1
    expect(m.tier1.inputFrequencyPerHour).toBeCloseTo(12.8, 0); // (8+8) / (45+30) * 60
    expect(m.tier1.avgInteractionMin).toBeCloseTo(37.5, 1);
    expect(m.tier1.avgAutonomousMin).toBeCloseTo(22.5, 0); // (1800+900)/2/60
    expect(m.tier1.interruptionRate).toBeCloseTo(0.1875, 3); // (2+1) / (8+8)

    // Tier 2
    expect(m.tier2.inputOutputRatio).toBeCloseTo(2.5, 1); // (120000+80000) / (45000+35000)
    expect(m.tier2.avgInputTokensPerMsg).toBeCloseTo(2325.58, 0); // 200000 / (43+43)
    expect(m.tier2.avgOutputTokensPerMsg).toBeCloseTo(930.23, 0); // 80000 / 86

    // Tier 3
    expect(m.tier3.completionRate).toBeCloseTo(0.5, 1);
    expect(m.tier3.toolErrorRate).toBeCloseTo(0.0277, 3); // 1 / 36
    expect(m.tier3.cacheHitRate).toBe(0); // no cache data
    expect(m.tier3.toolCallDensity).toBeCloseTo(0.418, 2); // 36 / 86
    expect(m.tier3.estimatedCost).toBeGreaterThan(0);
  });

  it('handles empty sessions', () => {
    const m = computeProjectMetrics([]);
    expect(m.tier1.inputFrequencyPerHour).toBe(0);
    expect(m.tier2.inputOutputRatio).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expected FAIL**

```bash
npx vitest run tests/engine/metrics.test.ts
```

- [ ] **Step 3: Write `src/engine/metrics.ts`**

```typescript
import { SessionData, Tier1Metrics, Tier2Metrics, Tier3Metrics } from '../types.js';

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  default: { input: 3, output: 15 },
};

function estimateCost(sessions: SessionData[]): number {
  const pricing = MODEL_PRICING.default;
  let total = 0;
  for (const s of sessions) {
    total += (s.tokens.input / 1_000_000) * pricing.input;
    total += (s.tokens.output / 1_000_000) * pricing.output;
  }
  return Math.round(total * 100) / 100;
}

export function computeProjectMetrics(sessions: SessionData[]): {
  tier1: Tier1Metrics;
  tier2: Tier2Metrics;
  tier3: Tier3Metrics;
} {
  const n = sessions.length;
  if (n === 0) {
    const zero = { inputFrequencyPerHour: 0, avgInteractionMin: 0, avgAutonomousMin: 0, interruptionRate: 0 };
    return { tier1: { ...zero }, tier2: { avgInputTokensPerMsg: 0, avgOutputTokensPerMsg: 0, inputOutputRatio: 0 }, tier3: { cacheHitRate: 0, toolCallDensity: 0, completionRate: 0, estimatedCost: 0, toolErrorRate: 0 } };
  }

  // Tier 1
  const totalInputFreq = sessions.reduce((sum, s) => sum + (s.userMessageCount / Math.max(s.durationMinutes, 1) * 60), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalAutonomousMs = sessions.reduce((sum, s) => sum + s.autonomousMs, 0);
  const totalInterruptions = sessions.reduce((sum, s) => sum + s.interruptions, 0);
  const totalUserMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount, 0);

  const tier1: Tier1Metrics = {
    inputFrequencyPerHour: Math.round((totalInputFreq / n) * 10) / 10,
    avgInteractionMin: Math.round((totalDuration / n) * 10) / 10,
    avgAutonomousMin: Math.round((totalAutonomousMs / n / 60000) * 10) / 10,
    interruptionRate: Math.round((totalInterruptions / Math.max(totalUserMsgs, 1)) * 1000) / 1000,
  };

  // Tier 2
  const totalInput = sessions.reduce((sum, s) => sum + s.tokens.input, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.tokens.output, 0);
  const totalMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount + s.assistantMessageCount, 0);

  const tier2: Tier2Metrics = {
    avgInputTokensPerMsg: Math.round(totalInput / Math.max(totalMsgs, 1)),
    avgOutputTokensPerMsg: Math.round(totalOutput / Math.max(totalMsgs, 1)),
    inputOutputRatio: totalOutput > 0 ? Math.round((totalInput / totalOutput) * 10) / 10 : 0,
  };

  // Tier 3
  const totalCache = sessions.reduce((sum, s) => sum + (s.tokens.cacheCreation ?? 0) + (s.tokens.cacheRead ?? 0), 0);
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.totalToolCalls, 0);
  const totalToolErrors = sessions.reduce((sum, s) => sum + s.toolErrors, 0);
  const completed = sessions.filter(s => s.outcome === 'completed').length;

  const tier3: Tier3Metrics = {
    cacheHitRate: totalInput > 0 ? Math.round((totalCache / totalInput) * 1000) / 1000 : 0,
    toolCallDensity: totalMsgs > 0 ? Math.round((totalToolCalls / totalMsgs) * 1000) / 1000 : 0,
    completionRate: Math.round((completed / n) * 1000) / 1000,
    estimatedCost: estimateCost(sessions),
    toolErrorRate: totalToolCalls > 0 ? Math.round((totalToolErrors / totalToolCalls) * 1000) / 1000 : 0,
  };

  return { tier1, tier2, tier3 };
}
```

- [ ] **Step 4: Run test — expected PASS**

```bash
npx vitest run tests/engine/metrics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/metrics.ts tests/engine/metrics.test.ts
git commit -m "feat: 12-indicator metrics engine"
```

---

### Task 7: Aggregator

**Files:**
- Create: `src/engine/aggregator.ts`
- Create: `tests/engine/aggregator.test.ts`

- [ ] **Step 1: Write the failing test `tests/engine/aggregator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../../src/engine/aggregator.js';
import { SessionData } from '../../src/types.js';

describe('buildSnapshot', () => {
  it('groups sessions by project and computes global + per-project metrics', () => {
    const sessions: SessionData[] = [
      {
        sessionId: 's1', projectPath: '/tmp/proj-a', projectName: 'proj-a', toolName: 'claude',
        startTime: '2026-05-08T02:00:00Z', endTime: '2026-05-08T02:45:00Z',
        durationMinutes: 45, userMessageCount: 8, assistantMessageCount: 35,
        totalToolCalls: 18, toolErrors: 1,
        tokens: { input: 120000, output: 45000 },
        summary: '重构引擎', outcome: 'completed',
        userMessageTimestamps: [], interruptions: 2, autonomousMs: 1800000,
      },
      {
        sessionId: 's2', projectPath: '/tmp/proj-b', projectName: 'proj-b', toolName: 'claude',
        startTime: '2026-05-08T03:00:00Z', endTime: '2026-05-08T03:20:00Z',
        durationMinutes: 20, userMessageCount: 4, assistantMessageCount: 18,
        totalToolCalls: 10, toolErrors: 0,
        tokens: { input: 60000, output: 25000 },
        summary: '修复 bug', outcome: 'completed',
        userMessageTimestamps: [], interruptions: 0, autonomousMs: 900000,
      },
    ];

    const range = { start: '2026-05-05', end: '2026-05-12' };
    const snapshot = buildSnapshot(sessions, range, new Date('2026-05-12T15:30:00Z'));

    expect(snapshot.range).toEqual(range);
    expect(snapshot.global.totalSessions).toBe(2);
    expect(snapshot.global.totalTokens.input).toBe(180000);
    expect(snapshot.global.totalTokens.output).toBe(70000);
    expect(snapshot.projects).toHaveLength(2);

    const projA = snapshot.projects.find(p => p.name === 'proj-a')!;
    expect(projA.sessionCount).toBe(1);
    expect(projA.summaries).toEqual(['重构引擎']);
    expect(projA.totalTokens.input).toBe(120000);
  });

  it('handles empty sessions', () => {
    const snapshot = buildSnapshot([], { start: '2026-05-05', end: '2026-05-12' }, new Date());
    expect(snapshot.global.totalSessions).toBe(0);
    expect(snapshot.projects).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — expected FAIL**

```bash
npx vitest run tests/engine/aggregator.test.ts
```

- [ ] **Step 3: Write `src/engine/aggregator.ts`**

```typescript
import { SessionData, WeeklySnapshot } from '../types.js';
import { computeProjectMetrics } from './metrics.js';

export function buildSnapshot(
  sessions: SessionData[],
  range: { start: string; end: string },
  generatedAt: Date,
): WeeklySnapshot {
  const projects = new Map<string, SessionData[]>();

  for (const s of sessions) {
    const key = s.projectName;
    if (!projects.has(key)) projects.set(key, []);
    projects.get(key)!.push(s);
  }

  const totalInput = sessions.reduce((sum, s) => sum + s.tokens.input, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.tokens.output, 0);
  const totalMsgs = sessions.reduce((sum, s) => sum + s.userMessageCount + s.assistantMessageCount, 0);
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.totalToolCalls, 0);
  const totalToolErrors = sessions.reduce((sum, s) => sum + s.toolErrors, 0);
  const totalCache = sessions.reduce((sum, s) => sum + (s.tokens.cacheCreation ?? 0) + (s.tokens.cacheRead ?? 0), 0);
  const completed = sessions.filter(s => s.outcome === 'completed').length;

  const global = {
    totalSessions: sessions.length,
    totalTokens: { input: totalInput, output: totalOutput },
    estimatedCost: 0,
    inputOutputRatio: totalOutput > 0 ? Math.round((totalInput / totalOutput) * 10) / 10 : 0,
    avgSessionDurationMin: sessions.length > 0
      ? Math.round((sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length) * 10) / 10
      : 0,
    cacheHitRate: totalInput > 0 ? Math.round((totalCache / totalInput) * 1000) / 1000 : 0,
    avgToolCallsPerResponse: totalMsgs > 0 ? Math.round((totalToolCalls / totalMsgs) * 1000) / 1000 : 0,
    completionRate: sessions.length > 0 ? Math.round((completed / sessions.length) * 1000) / 1000 : 0,
    toolErrorRate: totalToolCalls > 0 ? Math.round((totalToolErrors / totalToolCalls) * 1000) / 1000 : 0,
  };

  // Compute cost from all projects
  const allMetrics = computeProjectMetrics(sessions);
  global.estimatedCost = allMetrics.tier3.estimatedCost;

  const projectSnapshots = Array.from(projects.entries()).map(([name, projSessions]) => {
    const metrics = computeProjectMetrics(projSessions);
    return {
      name,
      path: projSessions[0].projectPath,
      sessionCount: projSessions.length,
      totalTokens: {
        input: projSessions.reduce((s, s2) => s + s2.tokens.input, 0),
        output: projSessions.reduce((s, s2) => s + s2.tokens.output, 0),
      },
      tier1: metrics.tier1,
      tier2: metrics.tier2,
      tier3: metrics.tier3,
      summaries: projSessions.map(s => s.summary).filter(Boolean),
    };
  });

  return {
    week: `Week of ${range.start}`,
    range,
    generatedAt: generatedAt.toISOString(),
    global,
    projects: projectSnapshots,
  };
}
```

- [ ] **Step 4: Run test — expected PASS**

```bash
npx vitest run tests/engine/aggregator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/aggregator.ts tests/engine/aggregator.test.ts
git commit -m "feat: aggregator groups sessions by project, produces snapshot"
```

---

### Task 8: SQLite Storage

**Files:**
- Create: `src/storage/db.ts`
- Create: `tests/storage/db.test.ts`

- [ ] **Step 1: Write the failing test `tests/storage/db.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, upsertSnapshot, getSnapshot } from '../../src/storage/db.js';
import { WeeklySnapshot } from '../../src/types.js';

const testDbDir = resolve('/tmp/cc-week-report-test-db');
const testDbPath = resolve(testDbDir, 'cc-week.db');

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
  beforeEach(() => {
    rmSync(testDbDir, { recursive: true, force: true });
  });

  it('upserts and retrieves a snapshot', () => {
    const db = openDb(testDbPath);
    const snap = makeSnapshot();
    upsertSnapshot(db, snap);
    const retrieved = getSnapshot(db, '2026-05-05', '2026-05-12');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.global.totalSessions).toBe(2);
  });

  it('returns null for missing snapshot', () => {
    const db = openDb(testDbPath);
    const retrieved = getSnapshot(db, '2026-01-01', '2026-01-07');
    expect(retrieved).toBeNull();
  });

  it('upsert is idempotent', () => {
    const db = openDb(testDbPath);
    const snap = makeSnapshot();
    upsertSnapshot(db, snap);
    upsertSnapshot(db, snap);
    const retrieved = getSnapshot(db, '2026-05-05', '2026-05-12');
    expect(retrieved!.global.totalSessions).toBe(2);
  });
});
```

- [ ] **Step 2: Run test — expected FAIL**

```bash
npx vitest run tests/storage/db.test.ts
```

- [ ] **Step 3: Write `src/storage/db.ts`**

```typescript
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
```

- [ ] **Step 4: Run test — expected PASS**

```bash
npx vitest run tests/storage/db.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/storage/db.ts tests/storage/db.test.ts
git commit -m "feat: SQLite storage with idempotent snapshot upsert"
```

---

### Task 9: CLI Entry Point + Bash Script

**Files:**
- Create: `src/cli.ts`
- Create: `scripts/collect-weekly.sh`

- [ ] **Step 1: Write `src/cli.ts`**

```typescript
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
      const db = openDb(DB_PATH);
      const cached = getSnapshot(db, timeWindow.start.toISOString().slice(0, 10), timeWindow.end.toISOString().slice(0, 10));
      if (cached) {
        snapshot = cached;
        if (opts.json) {
          console.log(JSON.stringify(snapshot, null, 2));
          return;
        }
        process.stdout.write(JSON.stringify(snapshot));
        return;
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
    upsertSnapshot(db, snapshot);

    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      process.stdout.write(JSON.stringify(snapshot));
    }
  });

program.parse();
```

- [ ] **Step 2: Write `scripts/collect-weekly.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Run the TypeScript CLI via tsx
node --import tsx "$PROJECT_DIR/src/cli.ts" "$@"
```

```bash
chmod +x scripts/collect-weekly.sh
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/edy/projects/me/tech/cc-week-report && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Verify script runs (dry run)**

```bash
bash scripts/collect-weekly.sh --days 0 --json 2>&1 || true
```
Expected: Valid JSON output even if 0 sessions.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts scripts/collect-weekly.sh
git commit -m "feat: CLI entry point with cache-first collection pipeline"
```

---

### Task 10: Claude Code Skill File

**Files:**
- Create: `skills/weekly-report.md`

- [ ] **Step 1: Write `skills/weekly-report.md`**

````markdown
---
name: weekly-report
description: 生成 AI 开发周报 — 采集 Claude Code/Kimi CLI 的会话数据，统计 token 消耗与流畅度指标，LLM 总结各项目进展，渲染终端彩色报告。
category: productivity
---

# /weekly-report

生成过去一周的 AI 开发周报。脚本采集本地 Claude Code 和 Kimi CLI 会话数据，计算 12 项指标，由 LLM 对每个项目做自然语言总结。

## 用法

```
/weekly-report              # 过去 7 天，全 12 项指标
/weekly-report --days 3     # 过去 3 天
/weekly-report --week 2026-05-04  # 指定自然周
/weekly-report --brief      # 精简模式，不显示 Tier 1 详细指标
/weekly-report --json       # 仅输出 snapshot JSON
/weekly-report --force      # 强制重新采集
```

## 执行流程

### Step 1: 运行采集脚本

```bash
bash scripts/collect-weekly.sh [--days N | --week YYYY-MM-DD] [--force]
```

脚本输出 `snapshot.json` 到 stdout。如果已有缓存且未用 `--force`，直接返回缓存数据，无需重新采集。

脚本失败时，报告错误并停止。

### Step 2: 解析 snapshot

拿到 JSON 后，提取全局指标和各项目的聚合数据。

### Step 3: LLM 项目总结

对每个 project，把 `summaries[]` 数组喂给 LLM，生成 2-3 句自然语言总结：
- 输入：项目名 + summaries[] 字符串数组
- 输出：一段自然语言文字，概括本周在该项目上的主要工作内容
- 如果 summaries 为空，写"本周没有足够的会话数据来生成摘要"

### Step 4: 渲染报告

使用 chalk 风格的终端格式输出：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI 开发周报  <start> ~ <end>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: <N> sessions | Input <input_tokens> | Output <output_tokens>
Avg Duration: <duration> min | Cost: $<cost> | I/O Ratio: <ratio>

── 流畅度仪表板 ──

 人工输入频次    X.X/hr      AI 自主运行    XX min
 交互时长        XX min      被打断率       XX%
 工具调用密度    X.X/rsp     Cache 命中率   XX%
 工具错误率      X%          需求完成率     XX%

── 项目 <name> (<N> sessions, <input>/<output>) ──

  <LLM 生成的 2-3 句项目总结>

  流畅度: ████████░░ 中断率 X% | 自主运行 XXmin

── 项目 <name2> ... ──

  ...
```

### `--brief` 模式

不显示"流畅度仪表板"表格，仅显示全局概览行 + 项目总结区块。

### `--json` 模式

直接输出 raw snapshot JSON 到终端，不做任何渲染。
````

- [ ] **Step 2: Commit**

```bash
git add skills/weekly-report.md
git commit -m "feat: Claude Code skill for /weekly-report"
```

---

### Task 11: Integration Verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/edy/projects/me/tech/cc-week-report && npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Build project**

```bash
npm run build
```
Expected: `dist/` directory created with compiled JS.

- [ ] **Step 4: Run CLI smoke test**

```bash
node dist/cli.js --days 0 --json 2>&1 || true
```
Expected: Valid JSON with 0 sessions on stdout.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: integration verification, all tests passing"
```
