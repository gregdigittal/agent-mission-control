#!/usr/bin/env bash
set -euo pipefail

# Agent Bridge — One-command setup
# Usage: ./install.sh /path/to/your/repo

REPO_PATH="${1:-}"
BASE_DIR="$HOME/.agent-mc"

if [ -z "$REPO_PATH" ]; then
  echo "Usage: ./install.sh /path/to/your/repo"
  echo ""
  echo "This sets up the Agent Bridge for orchestrating Claude Code agents."
  exit 1
fi

# Resolve to absolute path
REPO_PATH="$(cd "$REPO_PATH" 2>/dev/null && pwd || echo "$REPO_PATH")"

echo "┌─────────────────────────────────────┐"
echo "│   Agent Bridge — Setup              │"
echo "└─────────────────────────────────────┘"
echo ""

# 1. Create directory structure
echo "Creating directories..."
mkdir -p "$BASE_DIR"/{commands/.processed,state/agents,logs,worktrees}

# 2. Install Node.js dependencies
echo "Installing dependencies..."
cd "$(dirname "$0")"
npm install

# 3. Build TypeScript
echo "Building TypeScript..."
npm run build

# 4. Generate session token
TOKEN=$(openssl rand -hex 32)
echo -n "$TOKEN" > "$BASE_DIR/.session_token"
chmod 600 "$BASE_DIR/.session_token"

# 5. Write default config if not exists
if [ ! -f "$BASE_DIR/config.json" ]; then
  cat > "$BASE_DIR/config.json" << JSONEOF
{
  "loop_interval_ms": 2000,
  "repo_path": "$REPO_PATH",
  "max_agents": 5,
  "auto_restart_on_crash": true,
  "worktree_bootstrap": {
    "copy_files": [".env", ".env.local"],
    "run_commands": ["npm install --silent"]
  },
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "",
    "enabled": false
  },
  "agent_defaults": {
    "model": "claude-sonnet-4-20250514",
    "max_turns": 50,
    "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
  },
  "agent_roles": {
    "lead": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Task", "SendMessage"],
      "directory_scope": ["/"]
    },
    "backend": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "directory_scope": ["/app", "/database", "/routes", "/tests"]
    },
    "frontend": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "directory_scope": ["/src", "/public", "/components", "/tests"]
    },
    "reviewer": {
      "tool_allowlist": ["Read", "Grep", "Glob"],
      "directory_scope": ["/"]
    }
  },
  "budget": {
    "session_limit_cents": null,
    "agent_limit_cents": null,
    "alert_threshold_pct": 80
  }
}
JSONEOF
  echo "Created config: $BASE_DIR/config.json"
else
  echo "Config already exists: $BASE_DIR/config.json"
fi

echo ""
echo "Setup complete!"
echo ""
echo "  Config:  $BASE_DIR/config.json"
echo "  Token:   ${TOKEN:0:8}..."
echo "  Repo:    $REPO_PATH"
echo ""
echo "Next steps:"
echo "  1. Edit $BASE_DIR/config.json if needed"
echo "  2. Run: cd $(dirname "$0") && npm start"
echo ""
echo "To enable Supabase sync, set supabase.enabled=true and add your anon_key."
