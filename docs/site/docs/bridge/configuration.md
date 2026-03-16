---
id: configuration
title: Bridge Configuration
sidebar_position: 2
---

# Bridge Configuration

The bridge reads its configuration from `~/.agent-mc/config.json` at startup. Edit this file to customise the bridge's behaviour.

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `repo_path` | — | **Required.** Absolute path to the git repository |
| `loop_interval_ms` | `2000` | Main loop interval in milliseconds |
| `max_agents` | `5` | Maximum number of concurrent agents |
| `auto_restart_on_crash` | `true` | Restart crashed agents (max 3 attempts) |
| `supabase.enabled` | `false` | Enable Supabase sync for remote/multi-device access |
| `supabase.url` | — | Supabase project URL |
| `supabase.anon_key` | — | Supabase anon/publishable key |
| `agent_defaults.model` | `claude-sonnet-4-20250514` | Default model for spawned agents |
| `agent_defaults.max_turns` | `50` | Default maximum conversation turns per agent |
| `agent_roles` | See below | Per-role tool allowlists and directory scopes |
| `budget.session_limit_cents` | `null` | Session-wide budget cap in cents (null = no limit) |
| `budget.agent_limit_cents` | `null` | Per-agent budget cap in cents (null = no limit) |

## Example Config

```json
{
  "loop_interval_ms": 2000,
  "repo_path": "/home/user/my-project",
  "max_agents": 5,
  "auto_restart_on_crash": true,
  "worktree_bootstrap": {
    "copy_files": [".env", ".env.local"],
    "run_commands": ["npm install --silent"]
  },
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anon_key": "your-anon-key",
    "enabled": false
  },
  "agent_defaults": {
    "model": "claude-sonnet-4-20250514",
    "max_turns": 50
  },
  "agent_roles": {
    "backend": {
      "tools": ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
      "scope": "src/"
    },
    "frontend": {
      "tools": ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
      "scope": "app/"
    }
  },
  "budget": {
    "session_limit_cents": null,
    "agent_limit_cents": null
  }
}
```

## Worktree Bootstrap

The `worktree_bootstrap` section controls what happens when a new git worktree is created for an agent:

- **`copy_files`** — files copied from the main repo into the worktree before the agent starts (e.g. `.env` files that are gitignored)
- **`run_commands`** — shell commands run inside the worktree after it is created (e.g. `npm install`)

## Agent Roles

Each role in `agent_roles` defines:

- **`tools`** — allowlist of Claude Code tools the agent is permitted to use
- **`scope`** — directory the agent is restricted to within the worktree

Agents attempting to use tools outside the allowlist will have those tool calls rejected.

## Community Role Templates

Pre-built role definitions for common agent types (backend engineer, frontend engineer, code reviewer, devops) are available in [`docs/agent-roles/`](../../../../docs/agent-roles/README.md). Copy the JSON contents of any template into your `agent_roles` config to get started quickly.

## Budget Caps

Setting budget caps prevents runaway cost from long-running agents:

- `session_limit_cents` — total spend limit across all agents in a session
- `agent_limit_cents` — per-agent spend limit

When a limit is hit, the agent is paused and a notification is written to the state file. Set to `null` for no limit.
