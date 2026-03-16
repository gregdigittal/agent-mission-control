#!/usr/bin/env bash
set -euo pipefail

if [ -z "${AMC_SUPABASE_URL:-}" ] || [ -z "${AMC_SUPABASE_KEY:-}" ]; then
    exit 0
fi

PROJECT_DIR="${PWD}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
STATE_FILE="${PROJECT_DIR}/agent_state.json"
SESSION_ID="$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"

HOOK_INPUT=""
if [ ! -t 0 ]; then
    HOOK_INPUT="$(cat)"
fi

TOOL_NAME="$(echo "$HOOK_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name','tool'))" 2>/dev/null || echo "tool")"
TS="$(date +%H:%M:%S)"

if [ -f "$STATE_FILE" ]; then
    JSON="$(cat "$STATE_FILE")"
else
    JSON=$(python3 -c "
import json, sys
print(json.dumps({
    'project': '${PROJECT_NAME}',
    'currentStageIdx': 0,
    'totalTasks': 0,
    'completedTasks': 0,
    'stages': [],
    'agents': [{
        'id': 'claude-agent',
        'name': 'Claude',
        'role': 'AI Agent',
        'type': 'leader',
        'status': 'working',
        'icon': '\u25c6',
        'task': 'Active \u2014 ${TOOL_NAME}',
        'taskId': None,
        'metrics': {'ctx': '0%', 'cost': '\$0.00', 'msgs': 0}
    }],
    'tasks': [],
    'events': [{'agent': 'Claude', 'type': 'tool', 'text': '${TOOL_NAME}', 'timestamp': '${TS}'}]
}))" 2>/dev/null || echo "{\"project\":\"${PROJECT_NAME}\",\"currentStageIdx\":0,\"totalTasks\":0,\"completedTasks\":0,\"stages\":[],\"agents\":[],\"tasks\":[],\"events\":[]}")
fi

curl -s -o /dev/null -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${AMC_SUPABASE_KEY}" \
    -H "x-session-id: ${SESSION_ID}" \
    "${AMC_SUPABASE_URL%/}/functions/v1/ingest-state" \
    -d "$JSON" &

exit 0
