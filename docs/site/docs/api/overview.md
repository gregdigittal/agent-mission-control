---
id: overview
title: API Overview
sidebar_position: 1
---

# API Overview

:::info TODO
This page is a placeholder. Full API documentation will be added by the agent-api work stream.

TODO[agent-api]: document the bridge IPC command API (command file format, session token auth, all command types and their payloads)
TODO[agent-api]: document the Supabase edge functions (ingest-state endpoint, auth headers, request/response shapes)
TODO[agent-api]: document the health check endpoint (GET /health, response schema)
:::

## Bridge IPC API

The bridge exposes a filesystem-based IPC API. Commands are written as JSON files to `~/.agent-mc/commands/`.

See [Bridge Overview](../bridge/overview#command-format) for the command file format and the full list of command types.

## Supabase API

The Supabase project exposes the standard PostgREST API at `https://your-project.supabase.co/rest/v1/`. All requests require a valid JWT in the `Authorization: Bearer <token>` header.

Tables available via the API:
- `agent_sessions` — session records
- `agents` — agent state and metrics
- `events` — audit events
- `kanban_tasks` — task board state
- `vps_nodes` — registered VPS nodes
- `approval_queue` — pending approvals

All tables have RLS enabled — queries are automatically filtered by the authenticated user.

## Health Check

The bridge writes `~/.agent-mc/state/heartbeat.json` on every loop cycle. This is the primary health indicator for the bridge process.

```json
{
  "ts": "2026-03-12T10:00:00Z",
  "status": "healthy",
  "agentCount": 3,
  "loopMs": 45
}
```
