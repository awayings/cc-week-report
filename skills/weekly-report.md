---
name: weekly-report
description: 生成 AI 开发周报 — 采集 Claude Code/Kimi CLI 的会话数据，统计 token 消耗与流畅度指标，LLM 总结各项目进展，渲染终端彩色报告。
category: productivity
---

# /weekly-report

生成过去一段时间的 AI 开发周报。脚本采集本地 Claude Code 和 Kimi CLI 会话数据，计算 12 项指标，由 LLM 对每个项目做自然语言总结。

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
cc-weekly [--days N | --week YYYY-MM-DD] [--force]
```

命令输出 `snapshot.json` 到 stdout。如果已有缓存且未用 `--force`，直接返回缓存数据。

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

总数: <N> sessions | 输入token: <input_tokens> | 输出token: <output_tokens>
平均时长: <duration> min | 成本: $<cost> | 输入输出比率: <ratio>

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
