# cc-week-report

AI 开发周报工具 — 从本地 Claude Code 和 Kimi CLI 会话数据中自动生成周报，**核心聚焦两个维度：AI 开发流畅度指标 和 项目工作内容总结。**

## 核心概念

### 流畅度指标（12 项，全量输出）

每周回答两个关键问题：**AI 用得顺不顺？钱花得值不值？**

| 层级 | 关注点 | 指标 |
|------|--------|------|
| **Tier 1** 使用节奏 | 交互是否高效？AI 在独立思考还是频繁被打断？ | 人工输入频次、交互时长、AI 自主运行时长、被打断率 |
| **Tier 2** Token 形态 | 每次对话的体积和效率如何？ | 平均输入/输出 token、Input:Output 比 |
| **Tier 3** 质量经济 | AI 完成率怎么样？花了多少钱？ | Cache 命中率、工具调用密度、需求完成率、成本估算、工具错误率 |

其中 **被打断率** 和 **AI 自主运行时长** 最能反映开发流畅度：
- 被打断率高 → AI 经常走错方向，需要人频繁修正
- 自主运行时长长 → AI 连续执行工具调用不被打断，独立思考能力强

### 项目工作总结

每个项目的 `summaries[]` 来自会话的 goal summary（Claude）或会话标题（Kimi），由 LLM 合并提炼为 2-3 句自然语言总结，回答"本周在这个项目上实际完成了什么"。

## 系统要求

- **Node.js** >= 22（`node --version` 检查）
- **npm** >= 10
- **C/C++ 编译工具链**（`better-sqlite3` 需要原生编译）
  - macOS: `xcode-select --install`
  - Ubuntu/Debian: `sudo apt-get install build-essential`
- **Git**（用于安装 Claude Code skill）

## 安装

### 方式一：一键安装脚本（推荐）

```bash
git clone <repo-url> cc-week-report
cd cc-week-report
bash scripts/install.sh
```

脚本会自动检查环境、安装依赖、构建、全局安装，并配置 Claude Code skill。

### 方式二：手动安装

```bash
cd cc-week-report
npm install
npm run build
npm install -g .
```

### 安装 Claude Code Skill

将 skill 链接到 Claude Code 项目命令目录：

```bash
# 全局可用（所有项目）
mkdir -p ~/.claude/commands
ln -sf "$(pwd)/skills/weekly-report.md" ~/.claude/commands/weekly-report.md

# 或仅当前项目可用
mkdir -p .claude/commands
ln -sf "$(pwd)/skills/weekly-report.md" .claude/commands/weekly-report.md
```

安装后在 Claude Code 中输入 `/weekly-report` 即可触发彩色终端报告。

## 使用

### CLI

```bash
# 默认：过去 7 天周报（JSON 输出）
cc-weekly --json | head -20

# 指定时间范围
cc-weekly --week 2026-05-04 --json    # 自然周（周一到周日）
cc-weekly --days 3 --json             # 过去 3 天

# 强制重新采集（忽略缓存）
cc-weekly --force --json

# 查看帮助
cc-weekly --help
```

### Claude Code Skill

```bash
/weekly-report                  # 过去 7 天
/weekly-report --days 3        # 过去 3 天
/weekly-report --force          # 强制重新扫描
```

Skill 会以彩色表格形式渲染终端报告，比裸 JSON 更易读。

## 输出示例

```json
{
  "range": { "start": "2026-05-05", "end": "2026-05-12" },
  "global": {
    "totalSessions": 16,
    "totalTokens": { "input": 2330388, "output": 157015 },
    "estimatedCost": 9.35,
    "inputOutputRatio": 14.8,
    "avgSessionDurationMin": 22.4,
    "cacheHitRate": 0,
    "completionRate": 0.25,
    "toolErrorRate": 0.112
  },
  "projects": [
    {
      "name": "risk-center",
      "sessionCount": 2,
      "totalTokens": { "input": 645479, "output": 29863 },
      "tier1": {
        "inputFrequencyPerHour": 4.5,
        "avgInteractionMin": 25.3,
        "avgAutonomousMin": 18.2,
        "interruptionRate": 0.15
      },
      "tier2": { "avgInputTokensPerMsg": 5200, "avgOutputTokensPerMsg": 780, "inputOutputRatio": 21.6 },
      "tier3": { "cacheHitRate": 0, "toolCallDensity": 1.8, "completionRate": 0.5, "estimatedCost": 2.15, "toolErrorRate": 0.08 },
      "summaries": [
        "优化风控规则引擎，重构 RuleMatchExecutor 类",
        "修复 Redis 连接池并发泄漏问题"
      ]
    }
  ]
}
```

### 解读示例

- `inputOutputRatio: 21.6` → 大量代码上下文被送入（读文件、lint 输出），输出较少，典型的重构/修复场景
- `interruptionRate: 0.15` → 15% 的用户消息包含纠正信号，流畅度一般
- `avgAutonomousMin: 18.2` → AI 平均连续运行 18 分钟无人干预
- `completionRate: 0.5` → 一半会话被标记为"已完成"

## 项目配置

首次运行会自动创建 `~/.cc-week-report/config.yaml`。可按需配置项目路径 → 显示名称映射：

```yaml
projects:
  /Users/edy/projects/risk-center: 风控中心
  /Users/edy/projects/cc-week-report: 周报工具
```

未配置的项目自动从路径末段取名为项目名。

## 数据与缓存

| 路径 | 用途 |
|------|------|
| `~/.cc-week-report/config.yaml` | 项目名称映射配置 |
| `~/.cc-week-report/cc-week.db` | SQLite 缓存（按日期范围 idempotent upsert） |
| `~/.claude/usage-data/session-meta/*.json` | Claude 会话元数据（输入） |
| `~/.claude/usage-data/facets/*.json` | Claude 会话 facets（输入） |
| `~/.kimi/sessions/<hash>/<sid>/wire.jsonl` | Kimi 会话事件流（输入） |
| `~/.kimi/sessions/<hash>/<sid>/state.json` | Kimi 会话状态（输入） |

**只读本地文件，零网络调用。**

## 开发

```bash
# 安装依赖
npm install

# 开发模式（免编译）
npm run dev -- --days 3 --json

# 运行测试
npm test

# 类型检查
npx tsc --noEmit

# 构建
npm run build
```

### 项目结构

```
src/
  types.ts              # 共享类型定义
  config.ts             # 配置加载
  time.ts               # 时间窗口计算
  cli.ts                # CLI 入口
  collectors/
    interface.ts        # Collector 接口
    claude.ts           # Claude 数据收集器
    kimi.ts             # Kimi 数据收集器
  engine/
    metrics.ts          # 12 项指标计算
    aggregator.ts       # 聚合生成快照
  storage/
    db.ts               # SQLite 缓存
scripts/
  collect-weekly.sh     # Bash 包装脚本
  install.sh            # 一键安装脚本
skills/
  weekly-report.md      # Claude Code skill
```

## 故障排查

### `better-sqlite3` 编译失败

确保已安装 C++ 编译工具链：
- macOS: `xcode-select --install`
- Linux: `sudo apt-get install build-essential python3`

### 无数据输出

检查数据源目录是否存在：
```bash
ls ~/.claude/usage-data/session-meta/   # Claude 数据
ls ~/.kimi/sessions/                     # Kimi 数据
```

Claude Code 需版本 >= 0.45 才会生成 `usage-data`。

### Skill 未识别

确认 skill 文件已正确链接：
```bash
ls -la ~/.claude/commands/weekly-report.md
# 或
ls -la .claude/commands/weekly-report.md
```

## License

MIT
