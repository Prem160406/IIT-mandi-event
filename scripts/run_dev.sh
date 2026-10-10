#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PORT="${1:-8000}"
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port "$PORT"
