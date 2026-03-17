---
id: overview
title: API Overview
sidebar_position: 1
---

# API Overview

Agent Mission Control exposes two API surfaces:

1. **REST API** — HTTP endpoints served by the Vercel app (`app/api/`) for session management, task tracking, and CI/CD integration
2. **Bridge IPC API** — filesystem-based command API for low-latency local orchestration

For a step-by-step tutorial, see [Using the API](../tutorials/using-the-api).

## REST API

### Authentication

All requests require `Authorization: Bearer <token>` where the token is the value of the `AGENT_MC_API_SECRET` environment variable.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions` | List sessions (paginated) |
| `POST` | `/api/sessions` | Create session + spawn agent |
| `GET` | `/api/sessions/:id` | Get session by ID |
| `PATCH` | `/api/sessions/:id` | Update session title or status |
| `DELETE` | `/api/sessions/:id` | Terminate session |
| `GET` | `/api/sessions/:id/tasks` | List tasks for a session |
| `PATCH` | `/api/sessions/:id/tasks` | Update a task |
| `POST` | `/api/webhooks/bridge` | Receive bridge completion events (reverse webhook) |
| `GET` | `/api/openapi` | OpenAPI 3.1 specification |

### Rate Limiting

60 requests per minute per API key. Sliding window. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Error Format

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

## Bridge IPC API

The bridge exposes a filesystem-based IPC API. Commands are written as JSON files to `~/.agent-mc/commands/`.

See [Bridge Overview](../bridge/overview#command-format) for the full command file format.

### All Command Types

| Type | Required Payload Fields | Description |
|------|------------------------|-------------|
| `spawn_agent` | `session_id`, `agent_key`, `role`, `prompt` | Spawn a new agent in a worktree |
| `terminate_agent` | `session_id`, `agent_key` | Gracefully stop an agent (SIGTERM) |
| `pause_agent` | `session_id`, `agent_key` | Suspend agent (SIGSTOP) |
| `resume_agent` | `session_id`, `agent_key` | Resume paused agent (SIGCONT) |
| `approve_task` | `session_id`, `task_id`, `approved` | Approve or reject an approval-gated action |
| `resolve_conflict` | `session_id`, `agent_key`, `file_path`, `strategy` | Resolve a git merge conflict |
| `explore_parallel` | `session_id`, `objective`, `approaches[]` | Launch parallel exploration competition |
| `update_config` | — | Reload config.json without restarting |

### Audit Log Format

Every command execution is written to `~/.agent-mc/logs/audit_YYYY-MM-DD.jsonl`:

```json
{
  "ts": "2026-03-12T10:00:00.000Z",
  "level": "info",
  "event": "spawn",
  "sessionId": "feat/add-login-page",
  "agentId": "backend-1",
  "data": { "pid": 12345, "model": "claude-sonnet-4-6", "worktree": "/home/user/.agent-mc/worktrees/..." }
}
```

Required fields on every entry: `ts` (RFC 3339), `level`, `event`. Optional: `sessionId`, `agentId`, `data`.

## Supabase API

With Supabase enabled, all state is also available via the standard PostgREST API at `https://your-project.supabase.co/rest/v1/`.

Requires a valid Supabase JWT in `Authorization: Bearer <jwt>`.

Tables:
- `agent_sessions` — session records with cost aggregation
- `agents` — per-agent state, metrics, PID
- `events` — audit event stream
- `kanban_tasks` — task board state with status machine enforcement
- `vps_nodes` — registered VPS nodes and heartbeat state
- `approval_queue` — pending human approval items

All tables have RLS enabled — queries are filtered to the authenticated user's workspaces.

## Health Check

The bridge writes `~/.agent-mc/state/heartbeat.json` on every main loop cycle:

```json
{
  "ts": "2026-03-12T10:00:00Z",
  "status": "healthy",
  "agentCount": 3,
  "loopMs": 45
}
```

Status values: `healthy` (all systems nominal), `degraded` (Supabase unreachable), `unhealthy` (state write failed).
