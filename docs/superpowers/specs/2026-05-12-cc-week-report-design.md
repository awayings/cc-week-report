# cc-week-report Design Spec

## Overview

混合形态的 AI 开发周报工具：核心脚本（TypeScript/Bash）负责从 Claude Code 和 Kimi CLI 的本地会话数据中采集、计算指标并缓存；Claude Code skill（`/weekly-report`）读取聚合数据，由 LLM 做项目内容总结并渲染终端彩色报告。

## Architecture

```
Phase 1: 脚本层（数据采集 + 指标计算）
  ~/.claude/usage-data/     ──→  ClaudeCollector    ──┐
  ~/.kimi/sessions/         ──→  KimiCollector      ──┤
                                                       │
                                                       ▼
                                                 Metrics Engine (12 metrics)
                                                       │
                                                       ▼
                                                 Aggregator (by project/day)
                                                       │
                                              ┌────────┴────────┐
                                              ▼                 ▼
                                     ~/.cc-week-report/    snapshot.json
                                       cc-week.db          (stdout)

Phase 2: Skill 层（LLM 总结 + 报告渲染）
  /weekly-report  →  读取 snapshot.json  →  LLM per-project summary
                                           →  chalk terminal report
```

## Data Flow

1. `scripts/collect-weekly.sh` 运行，确定时间窗口
2. 各 Collector 扫描本地会话文件，产出一致的 `CollectedData`
3. Metrics Engine 计算 12 指标，Aggregator 按项目/天聚合
4. 写入 SQLite（增量缓存）+ 输出 `snapshot.json` 到 stdout
5. Skill 读取 stdout JSON，LLM 对每个项目的 `summaries[]` 做 2-3 句自然语言总结
6. 拼接全局指标 + 项目总结 + 流畅度面板，chalk 渲染终端输出

## Time Window

- **默认**：过去 7 天（今天 -7 天 ~ 今天此刻）
- `--week 2026-05-04`：自然周（周一到周日）
- `--days N`：过去 N 天

snapshot 文件名格式：`snapshot-YYYY-MM-DD-YYYY-MM-DD.json`

## Metrics (12, all default)

### Tier 1 — 核心节奏

| Metric | Definition | Claude Source | Kimi Source |
|--------|-----------|---------------|-------------|
| 人工输入频次 | user msgs / session hour | session.jsonl user role count | wire.jsonl user turn count |
| 交互时长 | first to last turn (min) | session-meta start/end | state.json created/finished |
| AI 自主运行时长 | accumulated AI tool execution time without user interruption | session.jsonl gap analysis | wire.jsonl gap analysis |
| 被打断率 | correction msgs / total user msgs | signal word matching | same |

### Tier 2 — Token 形态

| Metric | Definition | Source |
|--------|-----------|--------|
| 平均输入 token/消息 | mean & median input tokens per msg | session-meta / wire.jsonl |
| 平均输出 token/消息 | mean & median output tokens per msg | session-meta / wire.jsonl |
| Input:Output 比 | total input / total output | direct division |

### Tier 3 — 质量/经济

| Metric | Definition | Source |
|--------|-----------|--------|
| Cache 命中率 | cache tokens / total input | session-meta (Claude only) |
| 工具调用密度 | tool_use per AI response | session.jsonl / wire.jsonl |
| 需求完成率 | outcome="completed" sessions / total | facets goal (Claude); heuristics (Kimi) |
| 成本估算 | Σ(model_price × token_count) | model name × token count × public pricing |
| 工具错误率 | tool errors / total tool_use | session.jsonl / wire.jsonl |

## snapshot.json Schema (Data Contract)

```json
{
  "week": "2026-W20",
  "range": { "start": "2026-05-05", "end": "2026-05-12" },
  "global": {
    "totalSessions": 42,
    "totalTokens": { "input": 1234567, "output": 456789 },
    "estimatedCost": 12.34,
    "inputOutputRatio": 2.7,
    "avgSessionDurationMin": 18.5,
    "cacheHitRate": 0.34,
    "avgToolCallsPerResponse": 2.1,
    "completionRate": 0.72,
    "toolErrorRate": 0.05
  },
  "projects": [
    {
      "name": "risk-center",
      "path": "~/projects/yj/voghion-risk-control-center",
      "sessionCount": 15,
      "totalTokens": { "input": 500000, "output": 180000 },
      "tier1": {
        "inputFrequencyPerHour": 3.2,
        "avgInteractionMin": 18.5,
        "avgAutonomousMin": 12.3,
        "interruptionRate": 0.12
      },
      "tier2": {
        "avgInputTokensPerMsg": 4500,
        "avgOutputTokensPerMsg": 1200,
        "inputOutputRatio": 2.7
      },
      "tier3": {
        "cacheHitRate": 0.34,
        "toolCallDensity": 2.1,
        "completionRate": 0.72,
        "estimatedCost": 5.67,
        "toolErrorRate": 0.03
      },
      "summaries": [
        "优化风控规则引擎，重构 RuleMatchExecutor 类",
        "修复 Redis 连接池并发泄漏问题"
      ]
    }
  ]
}
```

## Skill Interface

`/weekly-report` in Claude Code:

| Param | Effect |
|-------|--------|
| (none) | 过去 7 天，12 指标全量报告 |
| `--week 2026-W20` | 指定自然周 |
| `--days N` | 过去 N 天 |
| `--json` | 输出 snapshot JSON，不渲染报告 |
| `--brief` | 仅全局概览 + 项目总结，不显示 Tier 1 |
| `--project <name>` | 只看单个项目 |
| `--force` | 强制重新采集，忽略已有 snapshot |

## Data Sources (Read-Only)

- **Claude Code**: `~/.claude/usage-data/session-meta/<uuid>.json` + `facets/<uuid>.json` + `session.jsonl`
- **Kimi CLI**: `~/.kimi/sessions/<hash>/<sid>/wire.jsonl` + `context.jsonl` + `state.json`

Zero network / zero API calls during collection.

## Storage

- SQLite: `~/.cc-week-report/cc-week.db` (WAL mode)
- Tables: `session_summary` (per-session rows), `weekly_snapshot` (cached aggregation)
- All writes idempotent (ON CONFLICT DO UPDATE)

## Interaction Model

零交互，全自动。识别不了的项目自动归类为 "unknown"，事后用户可编辑 `~/.cc-week-report/config.yaml` 配置项目路径映射。

## Report Layout (Terminal)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI 开发周报  2026-05-05 ~ 2026-05-12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Global overview line (sessions, tokens, cost, ratio)
  Fluency dashboard table (4×2 or 3×3)
  Per-project sections with LLM summary + mini fluency bar
```

## Collector Plugin Architecture

Collectors implement a common interface:

```typescript
interface Collector {
  name: string;
  collect(start: Date, end: Date): Promise<CollectedData[]>;
}
```

Initial implementation: ClaudeCollector, KimiCollector. Adding new tools (Cursor, Windsurf, etc.) requires only implementing this interface.
