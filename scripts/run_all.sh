#!/usr/bin/env bash
# Starts the API (port 8000) and the frontend dev server (port 5173).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
cd frontend
[ -d node_modules ] || npm install
npm run dev
