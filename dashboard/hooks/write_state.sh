#!/usr/bin/env bash
# write_state.sh — Claude Code hook to write agent state
#
# Usage: Add to .claude/hooks.json:
#   {
#     "hooks": {
#       "post-tool-use": [{
#         "command": "/path/to/dashboard/hooks/write_state.sh",
#         "triggers": ["Edit", "Write", "Bash"]
#       }]
#     }
#   }
#
# This hook updates the agent_state.json file that the dashboard
# reads in File Watch mode. It captures the current agent's activity
# and writes it to the dashboard directory.

DASHBOARD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="${DASHBOARD_DIR}/agent_state.json"
AGENT_NAME="${AGENT_NAME:-$(hostname -s)}"
AGENT_KEY="${AGENT_KEY:-$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')}"
AGENT_ROLE="${AGENT_ROLE:-worker}"
AGENT_ICON="${AGENT_ICON:-🤖}"
SESSION_NAME="${SESSION_NAME:-Default}"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$(pwd)")}"

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read stdin for hook payload (if any)
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi

# Extract tool name and file from payload if available
TOOL_NAME=$(echo "$PAYLOAD" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4)
FILE_PATH=$(echo "$PAYLOAD" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4)

# Build event entry
EVENT_TYPE="tool"
EVENT_DESC="Used ${TOOL_NAME:-unknown tool}"
if [ -n "$FILE_PATH" ]; then
  EVENT_TYPE="file"
  EVENT_DESC="Modified ${FILE_PATH}"
fi

# If state file exists, update it; otherwise create fresh
if [ -f "$STATE_FILE" ]; then
  # Use python3 to safely update JSON — variables passed via environment to avoid injection
  AMC_STATE_FILE="$STATE_FILE" \
  AMC_AGENT_KEY="$AGENT_KEY" \
  AMC_AGENT_NAME="$AGENT_NAME" \
  AMC_EVENT_TYPE="$EVENT_TYPE" \
  AMC_EVENT_DESC="$EVENT_DESC" \
  AMC_TIMESTAMP="$TIMESTAMP" \
  AMC_FILE_PATH="${FILE_PATH:-}" \
  AMC_SESSION_NAME="$SESSION_NAME" \
  AMC_PROJECT_NAME="$PROJECT_NAME" \
  AMC_AGENT_ROLE="$AGENT_ROLE" \
  AMC_AGENT_ICON="$AGENT_ICON" \
  python3 -c "
import json, os, uuid

state_file = os.environ['AMC_STATE_FILE']
agent_key = os.environ['AMC_AGENT_KEY']
agent_name = os.environ['AMC_AGENT_NAME']
event_type = os.environ['AMC_EVENT_TYPE']
event_desc = os.environ['AMC_EVENT_DESC']
timestamp = os.environ['AMC_TIMESTAMP']
file_path = os.environ.get('AMC_FILE_PATH', '')

try:
    with open(state_file, 'r') as f:
        state = json.load(f)
except:
    state = {'sessions': []}

if not state.get('sessions'):
    state['sessions'] = [{
        'id': 'sess-auto',
        'name': os.environ['AMC_SESSION_NAME'],
        'status': 'active',
        'currentStage': 0,
        'projectName': os.environ['AMC_PROJECT_NAME'],
        'totalTasks': 0,
        'completedTasks': 0,
        'budgetLimit': 5000,
        'totalCost': 0,
        'agents': [],
        'events': [],
        'tasks': [],
        'approvals': []
    }]

session = state['sessions'][0]

# Update or add agent
agent = None
for a in session.get('agents', []):
    if a.get('key') == agent_key:
        agent = a
        break

if not agent:
    agent = {
        'id': f'agent-{agent_key}',
        'key': agent_key,
        'name': agent_name,
        'role': os.environ['AMC_AGENT_ROLE'],
        'icon': os.environ['AMC_AGENT_ICON'],
        'status': 'working',
        'task': '',
        'ctx': 0,
        'cost': 0,
        'msgs': 0,
        'files': [],
        'budgetLimit': 1000
    }
    session.setdefault('agents', []).append(agent)

agent['status'] = 'working'
agent['msgs'] = agent.get('msgs', 0) + 1
if file_path and file_path not in agent.get('files', []):
    agent.setdefault('files', []).append(file_path)
    agent['files'] = agent['files'][-5:]  # Keep last 5

# Add event
event = {
    'id': f'evt-{str(uuid.uuid4())[:8]}',
    'type': event_type,
    'agent': agent_key,
    'desc': event_desc,
    'time': timestamp
}
session.setdefault('events', []).insert(0, event)
session['events'] = session['events'][:100]  # Keep last 100

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null
else
  # Create initial state file — use python3 to safely build JSON without shell interpolation
  AMC_STATE_FILE="$STATE_FILE" \
  AMC_AGENT_KEY="$AGENT_KEY" \
  AMC_AGENT_NAME="$AGENT_NAME" \
  AMC_SESSION_NAME="$SESSION_NAME" \
  AMC_PROJECT_NAME="$PROJECT_NAME" \
  AMC_AGENT_ROLE="$AGENT_ROLE" \
  AMC_AGENT_ICON="$AGENT_ICON" \
  AMC_TIMESTAMP="$TIMESTAMP" \
  python3 -c "
import json, os

state = {
    'sessions': [{
        'id': 'sess-auto',
        'name': os.environ['AMC_SESSION_NAME'],
        'status': 'active',
        'currentStage': 0,
        'projectName': os.environ['AMC_PROJECT_NAME'],
        'totalTasks': 0,
        'completedTasks': 0,
        'budgetLimit': 5000,
        'totalCost': 0,
        'agents': [{
            'id': f\"agent-{os.environ['AMC_AGENT_KEY']}\",
            'key': os.environ['AMC_AGENT_KEY'],
            'name': os.environ['AMC_AGENT_NAME'],
            'role': os.environ['AMC_AGENT_ROLE'],
            'icon': os.environ['AMC_AGENT_ICON'],
            'status': 'working',
            'task': '',
            'ctx': 0,
            'cost': 0,
            'msgs': 1,
            'files': [],
            'budgetLimit': 1000
        }],
        'events': [{
            'id': 'evt-init',
            'type': 'spawn',
            'agent': os.environ['AMC_AGENT_KEY'],
            'desc': f\"Agent {os.environ['AMC_AGENT_NAME']} started\",
            'time': os.environ['AMC_TIMESTAMP']
        }],
        'tasks': [],
        'approvals': []
    }]
}

with open(os.environ['AMC_STATE_FILE'], 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null
fi
