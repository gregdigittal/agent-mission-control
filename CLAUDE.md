# Agent Mission Control

Real-time dashboard for monitoring and orchestrating teams of AI coding agents (Claude Code) running across git worktrees, with session management, kanban task tracking, approval workflows, and cost monitoring.

## Project Layout

```
agent-mission-control/
├── dashboard/          MVP: single-file HTML/CSS/JS dashboard
├── bridge/             Node.js/TypeScript orchestration daemon
├── app/                React/Vite OSS dashboard (Milestone 3 — in progress)
├── Dashboard-prompts/  Build prompts for each milestone
├── BACKLOG.md          Full milestone backlog with status
├── FUNCTIONAL_SPEC.md  Detailed functional specification
└── .claude/
    ├── rules/          Project-specific rule extensions
    └── agents/         Specialist agent definitions
```

## Current Status

| Milestone | Status |
|-----------|--------|
| M0: Foundation (Supabase schema, RLS, triggers) | ✅ Complete |
| M1: Personal Dashboard MVP (`dashboard/index.html`) | ✅ Complete |
| M2: Hybrid Bridge (`bridge/`) | ✅ Complete |
| **M3: React Dashboard (`app/`)** | **🔲 In Progress** |
| M4: Multi-VPS Orchestration | 🔲 Backlog |
| M5: MCP Server | 🔲 Backlog |

## Supabase Project

- **Project ID:** `zpsnbogldtepmfwgqarz`
- **Region:** eu-west-1
- **Tables:** `profiles`, `projects`, `agent_sessions`, `agents`, `events`, `kanban_tasks`, `vps_nodes`, `model_configs`, `approval_queue`
- All tables have RLS enabled. Realtime enabled on 6 tables.

## Architecture in One Sentence

The **bridge** daemon orchestrates Claude Code agents on the filesystem and writes state to **Supabase** (or a local JSON file); the **dashboard** reads that state in real time.

See `.claude/rules/architecture.md` for the full architecture diagram and invariants.

## Key Rules

- **Bridge has zero network listeners** — filesystem IPC only. See `review-gate-extensions.md`.
- **Audit logs are append-only** — `appendFile` only, never delete or truncate.
- **Session tokens use `crypto.randomBytes(32)`** — never Math.random.
- **Dashboard credentials come from env/config** — never hardcoded in source.
- **State files use atomic writes** — write to `.tmp`, then `rename`.

See `.claude/rules/` for the full rule set.

## Quick Commands

```bash
# Build bridge
cd bridge && npm run build

# Type-check bridge (no emit)
cd bridge && npx tsc --noEmit

# Start bridge
cd bridge && npm start

# Serve MVP dashboard
cd dashboard && python3 -m http.server 8080

# Dev React app
cd app && npm run dev

# Build React app
cd app && npm run build
```

## Environment Variables

### Bridge (`bridge/config.json` or env)
```json
{
  "commandDir": "./commands",
  "outputDir": "./state",
  "logDir": "./logs",
  "supabaseUrl": "",
  "supabaseKey": "",
  "pollIntervalMs": 2000
}
```

### React App (`app/.env`)
```
VITE_SUPABASE_URL=https://zpsnbogldtepmfwgqarz.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## Known Issues / Flags

- `dashboard/index.html` lines 478-479: Supabase URL and anon key are hardcoded (MVP grandfathered). React app (`app/`) must use env vars exclusively.
- No test suite exists yet (TD-002, TD-003 in backlog).
- No CI/CD pipeline (TD-004 in backlog).

## Specialist Agents

- **bridge work** → use `.claude/agents/bridge-agent.md`
- **dashboard/app work** → use `.claude/agents/dashboard-agent.md`
