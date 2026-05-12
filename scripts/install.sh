#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------- 检查 Node.js ----------
log_info "检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装，请先安装 Node.js >= 22"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
    log_error "Node.js 版本过低: $NODE_VERSION，需要 >= 22"
    exit 1
fi
log_ok "Node.js $NODE_VERSION"

# ---------- 检查 npm ----------
log_info "检查 npm..."
if ! command -v npm &> /dev/null; then
    log_error "npm 未安装"
    exit 1
fi
NPM_VERSION=$(npm --version)
log_ok "npm $NPM_VERSION"

# ---------- 检查 Git ----------
log_info "检查 Git..."
if ! command -v git &> /dev/null; then
    log_warn "Git 未安装，跳过 skill 安装"
    HAS_GIT=false
else
    log_ok "git $(git --version | awk '{print $3}')"
    HAS_GIT=true
fi

# ---------- 安装依赖 ----------
log_info "安装 npm 依赖..."
cd "$PROJECT_DIR"
npm install
log_ok "依赖安装完成"

# ---------- 构建 ----------
log_info "构建项目..."
npm run build
log_ok "构建完成"

# ---------- 全局安装 ----------
log_info "全局安装 cc-weekly CLI..."
npm install -g .
log_ok "cc-weekly 已全局安装"

# ---------- 创建配置目录 ----------
CONFIG_DIR="$HOME/.cc-week-report"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

if [ ! -d "$CONFIG_DIR" ]; then
    log_info "创建配置目录 $CONFIG_DIR..."
    mkdir -p "$CONFIG_DIR"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    log_info "创建默认配置文件..."
    cat > "$CONFIG_FILE" << 'EOF'
# project path --> display name mapping
# unmatched projects show as "unknown"
projects: {}
EOF
    log_ok "配置文件已创建: $CONFIG_FILE"
else
    log_warn "配置文件已存在，跳过: $CONFIG_FILE"
fi

# ---------- 安装 Claude Code Skill ----------
if [ "$HAS_GIT" = true ]; then
    GLOBAL_COMMANDS_DIR="$HOME/.claude/commands"

    echo
    log_info "Claude Code Skill 安装"
    echo "  Skill 可以让您在 Claude Code 中用 /weekly-report 触发彩色终端报告"
    echo
    echo "  选择安装范围:"
    echo "    1) 全局可用（所有项目都能用 /weekly-report）"
    echo "    2) 仅当前项目可用"
    echo "    3) 跳过"
    echo
    read -rp "  请输入选项 [1/2/3，默认 1]: " choice
    choice=${choice:-1}

    case "$choice" in
        1)
            mkdir -p "$GLOBAL_COMMANDS_DIR"
            ln -sf "$PROJECT_DIR/skills/weekly-report.md" "$GLOBAL_COMMANDS_DIR/weekly-report.md"
            log_ok "Skill 已安装到 $GLOBAL_COMMANDS_DIR/weekly-report.md"
            log_info "在任意项目的 Claude Code 中输入 /weekly-report 即可使用"
            ;;
        2)
            LOCAL_COMMANDS_DIR="$PROJECT_DIR/.claude/commands"
            mkdir -p "$LOCAL_COMMANDS_DIR"
            ln -sf "$PROJECT_DIR/skills/weekly-report.md" "$LOCAL_COMMANDS_DIR/weekly-report.md"
            log_ok "Skill 已安装到 $LOCAL_COMMANDS_DIR/weekly-report.md"
            log_info "在当前项目的 Claude Code 中输入 /weekly-report 即可使用"
            ;;
        *)
            log_warn "跳过 Skill 安装"
            log_info "如需稍后手动安装，运行:"
            echo "    mkdir -p ~/.claude/commands"
            echo "    ln -sf \"$PROJECT_DIR/skills/weekly-report.md\" ~/.claude/commands/weekly-report.md"
            ;;
    esac
fi

# ---------- 完成 ----------
echo
log_ok "安装完成！"
echo
echo "快速开始:"
echo "  cc-weekly --json              # 过去 7 天周报（JSON）"
echo "  cc-weekly --days 3 --json     # 过去 3 天"
echo "  cc-weekly --force --json      # 强制重新采集"
echo
echo "配置项目名称映射:"
echo "  编辑 $CONFIG_FILE"
echo
