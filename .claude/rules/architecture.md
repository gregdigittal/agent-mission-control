# Architecture Rules — Agent Mission Control

## System Overview

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
│  N × `claude --headless` processes                       │
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

---

## Layer Responsibilities

### Dashboard (Presentation Only)
- Renders state — it does NOT mutate state directly
- Sends commands by writing `cmd-*.json` files or inserting to Supabase `commands` table
- Never spawns agents, never touches git, never reads agent output files directly
- All business logic lives in the bridge or Supabase — none in the dashboard

### Bridge (Orchestration Only)
- The ONLY layer that touches the filesystem for agent state
- The ONLY layer that spawns or terminates Claude Code processes
- The ONLY layer that reads git worktree state
- Does NOT serve HTTP — zero network listeners (see `review-gate-extensions.md`)
- Writes a single state snapshot (`dashboard_state.json`) per cycle for the dashboard to consume
- Optionally pushes state to Supabase as a convenience — Supabase is not required for operation

### Supabase (Data + Auth)
- Source of truth for: user profiles, sessions, agents, events, kanban tasks, cost records, approval queue
- All tables protected by RLS — no table is readable without a valid user context
- Realtime subscriptions deliver live updates to the dashboard
- NOT required for bridge operation — bridge runs fine with filesystem IPC only

### Agent Runtime (Isolated Execution)
- Each Claude Code instance is isolated to one git worktree
- Agents do NOT share context, files, or state with each other during execution
- Agent state (tool calls, costs, current task) is read by the bridge from `~/.claude/projects/*/` state files
- Agents communicate back via the MCP server (Milestone 5) or by writing agreed-upon state files

---

## Key Architectural Invariants

1. **Bridge is the only process that spawns agents.** The dashboard sends a `spawn` command; the bridge executes it. Never bypass this.

2. **No data flows dashboard → agent directly.** Commands flow: Dashboard → IPC/Supabase → Bridge → Agent.

3. **Supabase is the persistence layer, not the IPC layer.** For live operation, filesystem IPC is lower latency and more reliable. Supabase is used for history, auth, and multi-device access.

4. **JSON fallback is degraded mode, not an alternative architecture.** When Supabase is unavailable, the dashboard falls back to polling `dashboard_state.json`. This is a resilience feature, not a supported deployment mode. Supabase should be configured.

5. **Approval gates are enforced at the bridge, not the UI.** The bridge will not execute a flagged action until an approval record exists in Supabase or in the local approval state. The dashboard approval UI is just a way to send that approval — the gate lives in bridge code.

6. **Audit logs are append-only and immutable.** Any change to audit log handling requires explicit architectural review. Logs must be rotatable by creating new files, never by modifying existing ones.

---

## Multi-VPS Readiness (Future)

Current deployment is single-VPS. All code must be written as if multi-VPS is coming:

- All paths read from `config.json` — no hardcoded `/home/gregmorris/` or similar
- VPS identity (node ID) comes from config, not hostname
- The bridge is designed to be deployed to multiple nodes; each node runs a bridge instance reporting to the same Supabase project
- The dashboard aggregates data across all registered VPS nodes via Supabase queries
- SSH/rsync transport for worktree sync is a future concern — don't design against it now

---

## Technology Constraints

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Bridge transport | Filesystem IPC | Zero attack surface, no firewall rules needed |
| Agent runtime | Claude Code CLI | Only supported runtime for Claude agents |
| Auth | Supabase Auth (JWT + RLS) | No custom auth server to maintain |
| Realtime | Supabase Realtime | Consistent with data layer |
| Dashboard (MVP) | Vanilla HTML/JS | No build step, VPS-portable, air-gap safe |
| Dashboard (OSS) | React + Vite + Vercel | Best DX for open-source contributors |
| State management | Zustand | Minimal boilerplate, no context hell |
| Drag and drop | @dnd-kit | Accessible, touch-friendly |
