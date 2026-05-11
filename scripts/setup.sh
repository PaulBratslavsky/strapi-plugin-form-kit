#!/usr/bin/env bash
# First-time setup for the strapi-forms monorepo.
#
# Idempotent — safe to re-run. Installs workspace deps, rebuilds native
# modules, and builds both packages so the test-app can boot.
#
# Usage:
#   ./scripts/setup.sh            full setup
#   ./scripts/setup.sh --no-test  skip the unit-test step
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- styling -----------------------------------------------------------------
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  BOLD=$(tput bold); DIM=$(tput dim); RED=$(tput setaf 1); GREEN=$(tput setaf 2)
  YELLOW=$(tput setaf 3); BLUE=$(tput setaf 4); RESET=$(tput sgr0)
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step() { printf "\n${BOLD}${BLUE}==> %s${RESET}\n" "$1"; }
ok()   { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}!${RESET} %s\n" "$1"; }
die()  { printf "${RED}✗ %s${RESET}\n" "$1" >&2; exit 1; }

# --- options -----------------------------------------------------------------
RUN_TESTS=1
for arg in "$@"; do
  case "$arg" in
    --no-test|--skip-test) RUN_TESTS=0 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

# --- prerequisites -----------------------------------------------------------
step "Checking prerequisites"

command -v node >/dev/null 2>&1 || die "node is not installed (need >= 20)"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "node $NODE_MAJOR.x found; need >= 20 (Strapi v5 requirement)"
fi
ok "node $(node --version)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — installing via corepack"
  corepack enable
  corepack prepare pnpm@10.28.1 --activate
fi
ok "pnpm $(pnpm --version)"

# --- install -----------------------------------------------------------------
step "Installing workspace dependencies"
pnpm install
ok "deps installed"

# --- rebuild native deps -----------------------------------------------------
# better-sqlite3 / esbuild / sharp need their build scripts to run. The
# onlyBuiltDependencies allowlist in pnpm-workspace.yaml handles this on
# fresh installs, but rebuilding here makes the script robust against
# pre-existing node_modules from a different machine.
step "Rebuilding native dependencies"
pnpm rebuild better-sqlite3 esbuild sharp >/dev/null 2>&1 || true
ok "native modules rebuilt"

# --- build the plugin --------------------------------------------------------
step "Building strapi-plugin-forms"
pnpm --filter strapi-plugin-forms build
ok "plugin built ($(du -sh packages/plugin/dist 2>/dev/null | awk '{print $1}'))"

# --- build the embed ---------------------------------------------------------
step "Building @strapi-forms/embed"
pnpm --filter '@strapi-forms/embed' build
ok "embed built"

if command -v du >/dev/null 2>&1 && [ -f packages/embed/dist/embed.iife.js ]; then
  GZ=$(gzip -c packages/embed/dist/embed.iife.js | wc -c | awk '{printf "%.2f", $1/1024}')
  ok "embed.iife.js: ${GZ} KB gzipped (target < 20 KB)"
fi

# --- prep the test-app -------------------------------------------------------
step "Preparing test-app"
mkdir -p test-app/.tmp
ok "test-app/.tmp ready"

# --- tests -------------------------------------------------------------------
if [ "$RUN_TESTS" = "1" ]; then
  step "Running unit tests"
  pnpm --filter strapi-plugin-forms test
  pnpm --filter '@strapi-forms/embed' test
  ok "all tests passed"
else
  warn "tests skipped (--no-test)"
fi

# --- done --------------------------------------------------------------------
printf "\n${BOLD}${GREEN}Setup complete.${RESET}\n\n"
printf "Next:\n"
printf "  ${DIM}# Boot Strapi with the plugin:${RESET}\n"
printf "  ./scripts/start.sh\n\n"
printf "  ${DIM}# Then open:${RESET}\n"
printf "  http://localhost:1337/admin\n"
