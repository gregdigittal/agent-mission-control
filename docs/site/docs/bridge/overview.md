---
id: overview
title: Bridge Overview
sidebar_position: 1
---

# Bridge Overview

The bridge is the orchestration daemon for Agent Mission Control. It sits between the dashboard and Claude Code agent sessions, translating commands into process spawns, monitoring health, and aggregating status.

**Zero network listeners.** All communication is via filesystem IPC and optional Supabase sync.

## How It Works

The bridge runs a 4-operation loop every 2 seconds:

1. **Health Check** — Verifies agent PIDs are alive, detects stale or crashed agents
2. **Command Processing** — Reads command files from `~/.agent-mc/commands/`, validates session tokens, executes
3. **Status Aggregation** — Reads Claude Code session data, writes `dashboard_state.json`
4. **Worktree Management** — Creates and cleans up git worktrees for agent isolation

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
| `approve_task` | `session_id`, `task_id`, `approved` | Approve or reject a task |
| `update_config` | — | Trigger config reload |

## Security

- **Session token** — auto-generated on first run. Every command must include this token.
- **Tool allowlisting** — each agent role gets explicit tool permissions enforced at spawn.
- **Directory scoping** — agents work in isolated git worktrees with `--project-dir`.
- **Audit logging** — every command, spawn, termination, and state change is logged.
- **No network listeners** — bridge never opens ports. Filesystem IPC only.

## Supabase Sync

When enabled, the bridge pushes agent state to Supabase tables (`agents`, `agent_sessions`) each loop cycle.

Set in `config.json`:

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anon_key": "your-key-here",
    "enabled": true
  }
}
```

The bridge works fully offline without Supabase — filesystem IPC is always the primary channel.

## Source Layout

```
bridge/src/
├── audit/          # Append-only JSONL audit logger
├── commands/       # Command file processor
├── health/         # Agent PID liveness monitoring
├── security/       # Session token validation
├── state/          # State aggregation and atomic writes
├── supabase/       # Optional Supabase sync
├── vps/            # SSH wrapper and VPS registry (multi-VPS)
└── worktree/       # Git worktree lifecycle management
```
