#!/usr/bin/env bash
# Build all publishable packages.
#
# Builds strapi-plugin-forms (CJS + ESM + .d.ts) and @strapi-forms/embed
# (ESM + CJS + IIFE + .d.ts + styles.css). Reports the embed bundle's
# gzipped size against the < 20 KB target.
#
# Usage:
#   ./scripts/build.sh              build both packages
#   ./scripts/build.sh --plugin     only the Strapi plugin
#   ./scripts/build.sh --embed      only the embed snippet
#   ./scripts/build.sh --clean      remove dist/ before building
#   ./scripts/build.sh --typecheck  also run tsc --noEmit on every package
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
BUILD_PLUGIN=1
BUILD_EMBED=1
CLEAN=0
TYPECHECK=0
for arg in "$@"; do
  case "$arg" in
    --plugin) BUILD_EMBED=0 ;;
    --embed) BUILD_PLUGIN=0 ;;
    --clean) CLEAN=1 ;;
    --typecheck) TYPECHECK=1 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

[ -d node_modules ] || die "node_modules missing — run ./scripts/setup.sh first"

# --- clean -------------------------------------------------------------------
if [ "$CLEAN" = "1" ]; then
  step "Cleaning previous build output"
  rm -rf packages/plugin/dist packages/embed/dist
  ok "dist/ folders removed"
fi

# --- typecheck (optional) ----------------------------------------------------
if [ "$TYPECHECK" = "1" ]; then
  step "Type-checking packages"
  pnpm -r --filter ./packages/* typecheck
  ok "typecheck clean"
fi

# --- plugin ------------------------------------------------------------------
if [ "$BUILD_PLUGIN" = "1" ]; then
  step "Building strapi-plugin-forms"
  pnpm --filter strapi-plugin-forms build
  if [ -d packages/plugin/dist ]; then
    SIZE=$(du -sh packages/plugin/dist 2>/dev/null | awk '{print $1}')
    ok "plugin dist/ built (${SIZE})"
  fi
fi

# --- embed -------------------------------------------------------------------
if [ "$BUILD_EMBED" = "1" ]; then
  step "Building @strapi-forms/embed"
  pnpm --filter '@strapi-forms/embed' build
  if [ -f packages/embed/dist/embed.iife.js ]; then
    GZ=$(gzip -c packages/embed/dist/embed.iife.js | wc -c | awk '{printf "%.2f", $1/1024}')
    GZ_INT=$(printf "%.0f" "$GZ")
    if [ "$GZ_INT" -gt 30 ]; then
      die "embed.iife.js is ${GZ} KB gzipped — ceiling is 30 KB"
    elif [ "$GZ_INT" -gt 20 ]; then
      warn "embed.iife.js is ${GZ} KB gzipped — over the 20 KB soft target"
    else
      ok "embed.iife.js: ${GZ} KB gzipped (target < 20 KB)"
    fi
  fi
fi

# --- summary -----------------------------------------------------------------
printf "\n${BOLD}${GREEN}Build complete.${RESET}\n"
[ "$BUILD_PLUGIN" = "1" ] && printf "  packages/plugin/dist/\n"
[ "$BUILD_EMBED" = "1" ] && printf "  packages/embed/dist/\n"
