#!/usr/bin/env bash
# DabbaBox Tiffin CRM — macOS/Linux launcher
set -e

cd "$(dirname "$0")/backend"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (one-time, ~30s)…"
  npm install
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
fi

# Open browser in background (best-effort)
( sleep 2 && (open http://localhost:4000 2>/dev/null || xdg-open http://localhost:4000 2>/dev/null) ) &

npm start
