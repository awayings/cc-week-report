# /weekly-report

生成 AI 开发周报。采集本地 Claude Code 和 Kimi CLI 会话数据，计算 12 项流畅度指标，对每个项目做 LLM 自然语言总结，渲染终端彩色报告。

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

### Step 1: 运行采集命令

```bash
cc-weekly [--days N | --week YYYY-MM-DD] [--force]
```

命令输出 `snapshot.json` 到 stdout。如果已有缓存且未用 `--force`，直接返回缓存数据。

命令失败时，报告错误并停止。

### Step 2: 解析 snapshot

拿到 JSON 后，提取 `global` 全局指标和 `projects[]` 各项目聚合数据。

### Step 3: LLM 项目总结

对每个 project，把 `summaries[]` 数组总结为 2-3 句自然语言：
- 如果 summaries 非空，提炼核心工作内容
- 如果 summaries 为空，写"本周没有足够的会话数据来生成摘要"

### Step 4: 渲染报告

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI 开发周报  2026-05-05 ~ 2026-05-12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

会话总数: 16 | 输入: 2.33M tokens | 输出: 157K tokens
平均时长: 22.4 min | 成本: $9.35 | 输入输出比: 14.8

── 流畅度仪表板 ──

 人工输入频次    5.2/hr      AI 自主运行    14.2 min
 交互时长        22.4 min    被打断率       12%
 工具调用密度    1.8/rsp     Cache 命中率   0%
 工具错误率      11%         需求完成率     25%

── risk-center (2 sessions, 645K in / 30K out) ──

  本周重点重构了风控规则引擎，RuleMatchExecutor 类已从硬编码
  迁移到 DSL 表达式。同步修复了 Redis 连接池在并发写场景下的
  泄漏问题。

  流畅度: ████████░░ 中断率 15% | 自主运行 18.2min

── douyin-downloader (4 sessions, 561K in / 67K out) ──

  ...
```

### `--brief` 模式

不显示"流畅度仪表板"表格，仅显示全局概览行 + 项目总结。

### `--json` 模式

直接输出 raw snapshot JSON。
