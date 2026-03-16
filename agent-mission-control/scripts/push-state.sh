#!/usr/bin/env bash
# push-state.sh — Push agent_state.json to Supabase Edge Function
# Called by Claude Code postToolCall hook
#
# Required env vars:
#   AMC_API_URL           — Supabase Edge Function URL (e.g. https://xxx.supabase.co/functions/v1/ingest-state)
#   SUPABASE_SERVICE_ROLE_KEY — Service role key for auth
#
# Optional env vars:
#   AMC_SESSION_ID        — Override session ID (defaults to directory-derived slug)

set -euo pipefail

STATE_FILE="agent_state.json"

# Exit silently if no state file
[[ -f "$STATE_FILE" ]] || exit 0

# Exit silently if env not configured
[[ -n "${AMC_API_URL:-}" ]] || exit 0
[[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || exit 0

# Derive session ID from directory name if not set
SESSION_ID="${AMC_SESSION_ID:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')}"

# POST to Edge Function
curl -sS -X POST "$AMC_API_URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d @"$STATE_FILE" \
  --max-time 5 \
  > /dev/null 2>&1 || true
