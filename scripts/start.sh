#!/usr/bin/env bash
# Boot the test-app with the plugin loaded.
#
# By default this runs `strapi develop` (auto-reloads on file changes).
# Pass --watch to additionally rebuild the plugin on its own changes.
#
# Usage:
#   ./scripts/start.sh            boot Strapi (rebuilds plugin once if dist is stale)
#   ./scripts/start.sh --watch    additionally watch packages/plugin and recompile on save
#   ./scripts/start.sh --reset    delete the SQLite db before starting (fresh state)
#   ./scripts/start.sh --prod     boot in production mode (strapi start, no auto-reload)
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
ok()   { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}!${RESET} %s\n" "$1"; }
die()  { printf "${RED}✗ %s${RESET}\n" "$1" >&2; exit 1; }
info() { printf "${BLUE}→${RESET} %s\n" "$1"; }

# --- options -----------------------------------------------------------------
WATCH=0
RESET_DB=0
PROD=0
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH=1 ;;
    --reset) RESET_DB=1 ;;
    --prod|--production) PROD=1 ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

# --- preflight ---------------------------------------------------------------
[ -d node_modules ] || die "node_modules missing — run ./scripts/setup.sh first"

# Free port 1337 if a previous run is still listening.
if lsof -i :1337 -t >/dev/null 2>&1; then
  warn "port 1337 is in use — killing the previous process"
  lsof -i :1337 -t | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Reset DB if requested.
if [ "$RESET_DB" = "1" ]; then
  rm -f test-app/.tmp/data.db
  warn "SQLite database deleted — Strapi will create a fresh one and re-seed the contact form"
fi
mkdir -p test-app/.tmp

# Build the plugin if dist/ is missing or older than its source.
PLUGIN_DIST="packages/plugin/dist/server/index.js"
NEED_BUILD=0
if [ ! -f "$PLUGIN_DIST" ]; then
  NEED_BUILD=1
elif [ -n "$(find packages/plugin/server packages/plugin/admin -newer "$PLUGIN_DIST" -print -quit 2>/dev/null)" ]; then
  NEED_BUILD=1
fi

if [ "$NEED_BUILD" = "1" ]; then
  info "Building strapi-plugin-forms (source newer than dist)"
  pnpm --filter strapi-plugin-forms build
  ok "plugin built"
else
  ok "plugin dist is up to date"
fi

# --- watcher (optional) ------------------------------------------------------
WATCHER_PID=""
if [ "$WATCH" = "1" ]; then
  info "Starting plugin watcher (rebuilds on save)"
  pnpm --filter strapi-plugin-forms watch >/tmp/strapi-forms-watch.log 2>&1 &
  WATCHER_PID=$!
  ok "watcher PID $WATCHER_PID — logs at /tmp/strapi-forms-watch.log"
fi

cleanup() {
  if [ -n "$WATCHER_PID" ] && kill -0 "$WATCHER_PID" 2>/dev/null; then
    info "Stopping plugin watcher"
    kill "$WATCHER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# --- boot --------------------------------------------------------------------
if [ "$PROD" = "1" ]; then
  info "Booting Strapi in production mode (strapi start)"
  exec pnpm --filter test-app start
else
  info "Booting Strapi in development mode (strapi develop)"
  printf "${DIM}    open http://localhost:1337/admin in your browser${RESET}\n"
  printf "${DIM}    admin user (from prior runs): admin@test.local / Welcome1!${RESET}\n\n"
  exec pnpm --filter test-app develop
fi
