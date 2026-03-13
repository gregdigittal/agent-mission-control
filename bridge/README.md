# Agent Bridge

Hybrid orchestration bridge for Agent Mission Control. Sits between the dashboard and Claude Code agent sessions, translating commands into process spawns, monitoring health, and aggregating status.

**Zero network listeners.** All communication via filesystem IPC and optional Supabase sync.

## Quick Start

```bash
# Install and configure
./install.sh /path/to/your/repo

# Start the bridge
npm start
```

## How It Works

The bridge runs a 4-operation loop every 2 seconds:

1. **Health Check** — Verifies agent PIDs are alive, detects stale/crashed agents
2. **Command Processing** — Reads command files from `~/.agent-mc/commands/`, validates session tokens, executes
3. **Status Aggregation** — Reads Claude Code session data, writes `dashboard_state.json`
4. **Worktree Management** — Creates/cleans up git worktrees for agent isolation

## Directory Structure

```
~/.agent-mc/
├── commands/           # Dashboard → Bridge commands
│   ├── cmd_<uuid>.json
│   └── .processed/     # Processed commands archived here
├── state/              # Bridge → Dashboard state
│   ├── dashboard_state.json
│   ├── agents/         # Per-agent state files
│   └── heartbeat.json  # Bridge health indicator
├── logs/               # Append-only audit trail
│   └── audit_YYYY-MM-DD.jsonl
├── worktrees/          # Git worktrees per agent
├── config.json         # Bridge configuration
└── .session_token      # Auth token (auto-generated)
```

## Command Format

Write JSON files to `~/.agent-mc/commands/` named `cmd_<uuid>.json`:

```json
{
  "id": "unique-id",
  "type": "spawn_agent",
  "timestamp": "2026-03-12T10:00:00Z",
  "session_token": "<token from .session_token>",
  "payload": {
    "session_id": "my-session",
    "agent_key": "backend",
    "role": "backend",
    "prompt": "Implement the auth middleware"
  }
}
```

### Command Types

| Type | Payload | Description |
|------|---------|-------------|
| `spawn_agent` | `session_id`, `agent_key`, `role`, `prompt?`, `model?` | Spawn a new agent in a worktree |
| `terminate_agent` | `session_id`, `agent_key` | Gracefully stop an agent |
| `pause_agent` | `session_id`, `agent_key` | SIGSTOP an agent |
| `resume_agent` | `session_id`, `agent_key` | SIGCONT a paused agent |
| `approve_task` | `session_id`, `task_id`, `approved` | Approve/reject a task |
| `update_config` | — | Trigger config reload |

## Configuration

Edit `~/.agent-mc/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `repo_path` | — | **Required.** Path to the git repository |
| `loop_interval_ms` | 2000 | Main loop interval |
| `max_agents` | 5 | Maximum concurrent agents |
| `auto_restart_on_crash` | true | Restart crashed agents (max 3 attempts) |
| `supabase.enabled` | false | Enable Supabase sync for remote access |
| `supabase.url` | — | Supabase project URL |
| `supabase.anon_key` | — | Supabase anon/publishable key |
| `agent_defaults.model` | claude-sonnet-4-20250514 | Default model for agents |
| `agent_defaults.max_turns` | 50 | Default max conversation turns |
| `agent_roles` | See config | Per-role tool allowlists and directory scopes |
| `budget.session_limit_cents` | null | Session-wide budget cap |
| `budget.agent_limit_cents` | null | Per-agent budget cap |

## Security

- **Session token**: Auto-generated on first run. Every command must include this token.
- **Tool allowlisting**: Each agent role gets explicit tool permissions enforced at spawn.
- **Directory scoping**: Agents work in isolated git worktrees with `--project-dir`.
- **Audit logging**: Every command, spawn, termination, and state change is logged.
- **No network listeners**: Bridge never opens ports. Filesystem IPC only.

## Supabase Sync

When enabled, the bridge pushes agent state to Supabase tables (`agents`, `agent_sessions`) each loop cycle. This allows the web dashboard to show real-time data from anywhere.

Set in `config.json`:
```json
{
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "your-key-here",
    "enabled": true
  }
}
```

The bridge works fully offline without Supabase — filesystem IPC is always the primary channel.
