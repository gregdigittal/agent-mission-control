---
id: architecture
title: Architecture
sidebar_position: 2
---

# Architecture

Agent Mission Control is built on a three-layer architecture: **Dashboard** (presentation) → **Bridge** (orchestration) → **Agent Runtime** (execution), with **Supabase** as the optional persistence and auth layer.

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER DEVICES                          │
│         Browser (ultrawide / laptop / mobile)            │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────┐
│               DASHBOARD (Presentation Layer)             │
│  MVP:  dashboard/index.html — static, VPS-served         │
│  OSS:  app/ — React/Vite, Vercel-deployed                │
│                                                          │
│  Reads: Supabase Realtime OR dashboard_state.json        │
│  Writes: cmd-*.json files (IPC) OR Supabase commands     │
└──────────────────────────┬──────────────────────────────┘
                           │ Supabase sync OR filesystem poll
                           ▼
┌─────────────────────────────────────────────────────────┐
│                BRIDGE (Orchestration Layer)              │
│  bridge/ — Node.js/TypeScript daemon                     │
│                                                          │
│  - Reads cmd-*.json, executes commands, archives         │
│  - Spawns Claude Code CLI per agent/worktree             │
│  - Monitors agent health (PID liveness, staleness)       │
│  - Writes dashboard_state.json every cycle               │
│  - Optionally syncs state to Supabase                    │
└──────────────────────────┬──────────────────────────────┘
                           │ child_process.spawn
                           ▼
┌─────────────────────────────────────────────────────────┐
│              AGENT RUNTIME (Execution Layer)             │
│  N × claude --headless processes                         │
│  Each isolated to its own git worktree                   │
│  Each has independent session context + token budget     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (Data + Auth Layer)                │
│  PostgreSQL + RLS + Realtime + Auth                      │
│  Source of truth for all persistent state                │
└─────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Dashboard (Presentation Only)

- Renders state — it does **not** mutate state directly
- Sends commands by writing `cmd-*.json` files or inserting to the Supabase `commands` table
- Never spawns agents, never touches git, never reads agent output files directly
- All business logic lives in the bridge or Supabase — none in the dashboard

### Bridge (Orchestration Only)

- The **only** layer that touches the filesystem for agent state
- The **only** layer that spawns or terminates Claude Code processes
- The **only** layer that reads git worktree state
- Has **zero network listeners** — all communication via filesystem IPC
- Writes a single state snapshot (`dashboard_state.json`) per cycle for the dashboard to consume
- Optionally pushes state to Supabase as a convenience

### Supabase (Data + Auth)

- Source of truth for: user profiles, sessions, agents, events, kanban tasks, cost records, approval queue
- All tables protected by RLS — no table is readable without a valid user context
- Realtime subscriptions deliver live updates to the dashboard
- **Not required for bridge operation** — the bridge runs fine with filesystem IPC only

### Agent Runtime (Isolated Execution)

- Each Claude Code instance is isolated to one git worktree
- Agents do **not** share context, files, or state with each other during execution
- Agent state (tool calls, costs, current task) is read by the bridge from `~/.claude/projects/*/` state files

## Key Invariants

1. **Bridge is the only process that spawns agents.** The dashboard sends a `spawn` command; the bridge executes it.

2. **No data flows dashboard → agent directly.** Commands flow: Dashboard → IPC/Supabase → Bridge → Agent.

3. **Supabase is the persistence layer, not the IPC layer.** Filesystem IPC is lower latency and more reliable for live operation.

4. **JSON fallback is degraded mode.** When Supabase is unavailable, the dashboard polls `dashboard_state.json`. Configure Supabase for production use.

5. **Approval gates are enforced at the bridge, not the UI.** The bridge will not execute a flagged action until an approval record exists. The dashboard approval UI is just a way to send that approval.

6. **Audit logs are append-only and immutable.** Logs are rotatable by creating new files, never by modifying existing ones.

## Data Flow

```
Commands:   Dashboard → (cmd-*.json or Supabase) → Bridge → Claude Code
State:      Claude Code → Bridge reads PIDs/files → dashboard_state.json → Dashboard
Persistence: Bridge → Supabase → Dashboard (Realtime subscription)
```

## Technology Stack

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Bridge transport | Filesystem IPC | Zero attack surface, no firewall rules needed |
| Agent runtime | Claude Code CLI | Only supported runtime for Claude agents |
| Auth | Supabase Auth (JWT + RLS) | No custom auth server to maintain |
| Realtime | Supabase Realtime | Consistent with data layer |
| Dashboard (MVP) | Vanilla HTML/JS | No build step, VPS-portable |
| Dashboard (OSS) | React + Vite + Vercel | Best DX for contributors |
| State management | Zustand | Minimal boilerplate |
| Drag and drop | @dnd-kit | Accessible, touch-friendly |

## Multi-VPS Architecture

AMC supports running agents across multiple VPS nodes with all state aggregated into a single dashboard view.

```
Primary VPS (bridge/) ──SSH/rsync──► Remote VPS N (bridge-remote/)
       │                                      │
       └──────────────► Supabase ◄────────────┘
                             │
                         Dashboard
```

- State always flows: remote VPS → primary bridge → Supabase → dashboard
- Commands always flow: dashboard → Supabase → primary bridge → (SSH) → remote VPS
- Neither bridge instance opens any TCP/UDP port — all communication is outbound-only

See [multi-vps architecture](../multi-vps-architecture) for full details.
