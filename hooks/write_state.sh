#!/usr/bin/env bash
# =============================================================================
# write_state.sh — Agent Mission Control state writer
# =============================================================================
# Writes agent_state.json for consumption by Mission Control's File Watch mode.
#
# Usage:
#   ./hooks/write_state.sh                      # Interactive: reads from stdin (JSON)
#   ./hooks/write_state.sh --project "My App"   # Minimal: project name only
#   cat state.json | ./hooks/write_state.sh      # Pipe full JSON
#
# Claude Code hook integration (add to .claude/hooks/post-tool.sh):
#   ./path/to/write_state.sh --from-env
#
# Environment variables (--from-env mode):
#   AMC_PROJECT     Project name
#   AMC_STAGE_IDX   Current stage index (0-7)
#   AMC_TOTAL       Total task count
#   AMC_DONE        Completed task count
# =============================================================================

set -euo pipefail

OUTFILE="${AMC_OUTFILE:-agent_state.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# ---------- helpers -----------------------------------------------------------
ts() { date +%H:%M:%S; }

error() { echo "ERROR: $*" >&2; exit 1; }

# ---------- modes ------------------------------------------------------------
case "${1:-}" in

  --project)
    # Minimal mode: just update the project name + timestamp
    PROJECT="${2:-Unknown Project}"
    STAGE="${3:-0}"
    TOTAL="${4:-0}"
    DONE="${5:-0}"

    cat > "$REPO_DIR/$OUTFILE" <<JSON
{
  "project": "$PROJECT",
  "currentStageIdx": $STAGE,
  "totalTasks": $TOTAL,
  "completedTasks": $DONE,
  "stages": [
    {"name":"Planning",    "desc":"Architecture & task breakdown", "status":"pending"},
    {"name":"Scaffolding", "desc":"Project structure & config",    "status":"pending"},
    {"name":"Core Logic",  "desc":"Business logic & models",       "status":"pending"},
    {"name":"API Layer",   "desc":"REST endpoints & middleware",   "status":"pending"},
    {"name":"Frontend",    "desc":"React components & pages",      "status":"pending"},
    {"name":"Testing",     "desc":"Unit & integration tests",      "status":"pending"},
    {"name":"Integration", "desc":"End-to-end wiring",            "status":"pending"},
    {"name":"Review",      "desc":"Code review & polish",          "status":"pending"}
  ],
  "agents": [],
  "tasks": [],
  "events": [
    {"agent":"System","type":"message","text":"State updated via write_state.sh","timestamp":"$(ts)"}
  ]
}
JSON
    echo "Written $REPO_DIR/$OUTFILE (minimal mode)"
    ;;

  --from-env)
    # Environment variable mode (for Claude Code hooks)
    PROJECT="${AMC_PROJECT:-Unknown Project}"
    STAGE="${AMC_STAGE_IDX:-0}"
    TOTAL="${AMC_TOTAL:-0}"
    DONE="${AMC_DONE:-0}"
    exec "$0" --project "$PROJECT" "$STAGE" "$TOTAL" "$DONE"
    ;;

  --help|-h)
    sed -n '2,30p' "$0" | sed 's/^# //' | sed 's/^#//'
    ;;

  *)
    # Pipe / stdin mode: expect full JSON on stdin, write it directly
    if [ -t 0 ]; then
      echo "Usage:"
      echo "  $0 --project \"My Project\" [stage_idx] [total] [done]"
      echo "  $0 --from-env"
      echo "  cat state.json | $0"
      echo "  $0 --help"
      exit 0
    fi
    INPUT=$(cat)
    # Validate it's JSON (requires python3 or jq)
    if command -v python3 &>/dev/null; then
      echo "$INPUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null \
        || error "stdin is not valid JSON"
    elif command -v jq &>/dev/null; then
      echo "$INPUT" | jq . > /dev/null 2>&1 \
        || error "stdin is not valid JSON"
    fi
    echo "$INPUT" > "$REPO_DIR/$OUTFILE"
    echo "Written $REPO_DIR/$OUTFILE ($(echo "$INPUT" | wc -c | tr -d ' ') bytes)"
    ;;

esac
