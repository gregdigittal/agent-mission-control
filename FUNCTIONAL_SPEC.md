# Agent Mission Control — Functional Specification

**Version:** 1.0
**Date:** March 2026
**Status:** Active Development

---

## 1. Product Vision

Agent Mission Control is an open-source, real-time dashboard for monitoring and orchestrating AI coding agent teams across multiple VPS instances. It provides a unified mission-control interface where developers can observe agent activity, manage tasks via Kanban boards, enforce cost budgets, approve agent actions through graduated permission gates, and coordinate multi-agent workflows — all from a browser or mobile device.

The product ships in two editions:
- **Personal Edition (MVP):** A web-served dashboard deployed on the user's VPS, powered exclusively by Claude Code. Includes a responsive mobile view for phone-based orchestration.
- **Open-Source Edition:** A React/Supabase application supporting multiple LLM providers (Claude, GPT, Gemini, Ollama, self-hosted), multi-user auth, multi-VPS orchestration, and self-hostable infrastructure.

---

## 2. Users & Use Cases

### Primary User: Solo AI Developer ("Vibe Coder")
- Runs 2-5 Claude Code agent sessions concurrently on a VPS
- Wants unified visibility into what each agent is doing without switching terminal tabs
- Needs to approve/reject agent-recommended actions from their desk (ultrawide monitor) or on the go (phone)
- Needs cost tracking to avoid surprise bills
- Works across multiple projects (e.g., a Laravel app and a React app)

### Secondary User: Small Team
- 2-5 developers sharing VPS resources
- Need multi-user auth with isolated data
- Want shared project views and centralized billing visibility

### Key Use Cases
1. **Monitor:** Glance at the dashboard to see all agents' status, current tasks, context usage, and costs
2. **Approve:** Review and approve/reject Claude's task recommendations before work begins
3. **Orchestrate:** Assign tasks to agents, move work through Kanban columns, manage priorities
4. **Govern:** Set per-agent and per-session budget caps, receive alerts, auto-pause on limit
5. **Review:** Inspect the audit trail of what each agent did, when, and at what cost
6. **Mobile:** Check agent status and approve urgent actions from phone while away from desk

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER DEVICES                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Ultrawide│  │  Laptop  │  │   Mobile (Phone)     │  │
│  │ Browser  │  │ Browser  │  │   Responsive Web     │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
└───────┼──────────────┼───────────────────┼──────────────┘
        │              │                   │
        ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              DASHBOARD (Web Application)                 │
│                                                          │
│  MVP: Single HTML/CSS/JS served via HTTP from VPS        │
│  OSS: React + Vite deployed on Vercel                    │
│                                                          │
│  Connects to:                                            │
│  - Supabase (realtime state, auth, audit trail)          │
│  - Bridge (via filesystem IPC or Supabase sync)          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (Backend)                           │
│                                                          │
│  - PostgreSQL database (schema below)                    │
│  - Row Level Security (per-user data isolation)          │
│  - Realtime subscriptions (live dashboard updates)       │
│  - Edge Functions (approve-task, record-cost, etc.)      │
│  - Auth (email + GitHub OAuth)                           │
│                                                          │
│  Project: zpsnbogldtepmfwgqarz                           │
│  Region: eu-west-1                                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              HYBRID BRIDGE (Per VPS)                      │
│                                                          │
│  - Runs on each VPS as foreground Node.js process        │
│  - NO network listeners (filesystem IPC only)            │
│  - Spawns/monitors Claude Code agent processes           │
│  - Manages git worktrees for agent isolation              │
│  - Writes state to ~/.agent-mc/state/                    │
│  - Optionally syncs to Supabase                          │
│  - 4-loop cycle every 2s: health, commands, state, git   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              CLAUDE CODE AGENTS (Per VPS)                 │
│                                                          │
│  - Each runs in isolated git worktree                    │
│  - Scoped tool allowlists per role                       │
│  - MCP server for bidirectional dashboard comms          │
│  - Cost tracking per tool call                           │
│  - Reports status via MCP or filesystem                  │
└─────────────────────────────────────────────────────────┘
```

### Multi-VPS Extension

```
Primary VPS ──SSH──▶ Remote VPS 1 (agent-bridge-remote)
             ──SSH──▶ Remote VPS 2 (agent-bridge-remote)
             ──SSH──▶ Remote VPS N (agent-bridge-remote)
```

All inter-VPS communication is SSH-only. No additional ports.

---

## 4. Database Schema (Supabase)

**Project ID:** `zpsnbogldtepmfwgqarz`
**Status:** ✅ Deployed

### Tables

| Table | Purpose | RLS | Realtime |
|-------|---------|-----|----------|
| `profiles` | User accounts (extends auth.users) | ✅ | No |
| `projects` | Codebases being worked on | ✅ | No |
| `agent_sessions` | Active agent team sessions | ✅ | ✅ |
| `agents` | Individual agents in a session | ✅ | ✅ |
| `events` | Immutable audit trail (append-only) | ✅ (no update/delete) | ✅ |
| `kanban_tasks` | Task board with approval workflow | ✅ | ✅ |
| `vps_nodes` | Registered VPS instances | ✅ | ✅ |
| `model_configs` | User-defined LLM configurations | ✅ | No |
| `approval_queue` | Permission gate requests | ✅ | ✅ |

### Key Relationships
- `profiles` 1→N `projects` 1→N `agent_sessions` 1→N `agents`
- `agent_sessions` 1→N `events` (append-only)
- `agent_sessions` 1→N `kanban_tasks`
- `agent_sessions` N→1 `vps_nodes`
- `agents` trigger → `events` (budget exceeded auto-logged)
- `agent_sessions` trigger → `events` (session budget exceeded auto-logged)

### Budget Enforcement (Database-Level)
- `check_agent_budget()` trigger: auto-pauses agent when `cost_cents >= budget_limit_cents`
- `check_session_budget()` trigger: auto-pauses session when total cost exceeds limit
- Both triggers auto-log events to the audit trail

---

## 5. Screen Profiles & Responsive Design

| Profile | Target | Max Panes | CSS Class |
|---------|--------|-----------|-----------|
| Mobile | Phone (< 768px) | 1 | `screen-mobile` |
| Laptop | 14" (768-1440px) | 2 | `screen-laptop` |
| Desktop | 27" (1441-2560px) | 3 | `screen-desktop` |
| Ultrawide | 49" (2561px+) | 4 | `screen-ultrawide` |

**Mobile View Requirements:**
- Single-pane, full-width layout
- Bottom navigation bar: Agents | Kanban | Costs | Approvals
- Swipe between sessions (horizontal)
- Pull-to-refresh for manual state update
- Approval actions prominent and touch-friendly (large buttons)
- Agent cards stack vertically with collapsible details
- Kanban columns stack vertically or use horizontal scroll
- Push notification support (via Supabase Realtime → browser notifications API)

**All sizing via CSS custom properties** — see Prompt 1 for the complete variable set.

---

## 6. Feature Inventory

### 6.1 Agent Monitoring
- Real-time agent status (leader/working/thinking/idle/error/paused)
- Context window usage percentage per agent
- Cost tracking per agent (cents, with formatted display)
- Message count per agent
- Current task description
- Active files list
- Build stage pipeline (8 stages: Planning → Review)
- Progress ring (SVG, animated)

### 6.2 Kanban Board
- 4 columns: Backlog → To Do → In Progress → Done
- Drag-and-drop (HTML5 Drag API on desktop, touch events on mobile)
- Task tags: backend, frontend, testing, infra, review, database, security, devops
- Priority levels: 🔴 high, 🟠 medium, 🟡 low
- Claude recommendation badge (🤖)
- Approval workflow: needs_approval → approved → task advances
- Agent assignment per task
- Task dependencies (UUID array)

### 6.3 Activity Stream
- Reverse-chronological event feed
- Event types: tool, file, task, message, thinking, error, approval, cost, permission, spawn, terminate
- Filterable by type
- Animated entry (fade + slide)
- Agent name color-coded

### 6.4 Cost Governance
- Per-agent budget caps (cents)
- Per-session budget caps (cents)
- Auto-pause when budget exceeded (database trigger)
- Budget alert thresholds (configurable %)
- Burn rate indicator ($/hour extrapolated)
- Cost dashboard view per pane

### 6.5 Graduated Permissions (Traffic Light)
- 🟢 Auto-approve: reads, grep, glob, tests
- 🟡 Review recommended: file writes in scope, dependency changes
- 🔴 Mandatory approval: destructive ops, out-of-scope access, credentials
- Approval queue sidebar
- Rejection reason logging

### 6.6 Multi-Model Support (OSS Edition)
- Provider configs: Claude, OpenAI, Gemini, Ollama, custom endpoints
- Per-agent model assignment
- Cost calculation adapts per model
- Provider badge on agent cards

### 6.7 Multi-VPS Orchestration
- VPS node registration and health monitoring
- Heartbeat protocol (every 10s)
- System metrics (CPU, RAM, disk)
- Agent capacity per VPS
- Load balancing for agent spawning
- SSH-only inter-VPS communication

### 6.8 Sessions & Tiling
- Multiple concurrent sessions
- Color-coded session tabs (cyan, green, violet, amber, rose, blue)
- Tiling window system (1-4 panes)
- Each pane: independent Agent View or Kanban Board
- Each pane: independent session selector
- Smart pane defaults when adding layouts

---

## 7. Security Model

### Principles
1. **Zero network listeners** on the bridge — filesystem IPC only
2. **Append-only audit trail** — events table has no UPDATE/DELETE policies
3. **Scoped credentials** — agents inherit only filtered environment variables
4. **Tool allowlisting** — each agent role gets explicit tool permissions
5. **Directory scoping** — agents work in isolated git worktrees
6. **Session tokens** — bridge validates commands via local file token
7. **RLS everywhere** — Supabase enforces per-user data isolation

### Threat Model (Top Risks)
- Agent escaping worktree → mitigated by `--project-dir` scoping
- Command injection via dashboard → mitigated by session token validation
- Cross-user data access → mitigated by RLS policies
- Cost explosion → mitigated by database-level budget triggers
- Stale agent consuming resources → mitigated by health check loop

---

## 8. Technology Stack

### MVP (Personal Edition)
- **Frontend:** Single HTML/CSS/JS file (vanilla, no framework)
- **Served via:** `python3 -m http.server` or nginx on VPS
- **Data:** Supabase (realtime) + local `agent_state.json` fallback
- **Typography:** JetBrains Mono + DM Sans (Google Fonts CDN)
- **Mobile:** Responsive CSS with mobile-first media queries

### OSS Edition
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS 4
- **State:** Zustand (client) + Supabase Realtime (server)
- **Auth:** Supabase Auth (email + GitHub OAuth)
- **Database:** Supabase (PostgreSQL) — cloud or self-hosted
- **Deployment:** Vercel (dashboard) + VPS (bridge)
- **Bridge:** Node.js/TypeScript, minimal deps (chokidar, execa, zod)
- **MCP Server:** TypeScript, MCP SDK, stdio transport

### Design System
- Dark industrial mission-control aesthetic
- Color palette: deep navy backgrounds (#06080c → #242b3d)
- Accent: cyan (#22d3ee) primary, with green/amber/red/violet/blue/rose
- Scanline overlay effect
- Cyan glow on active elements
- Custom thin scrollbars

---

## 9. Deployment Topology

### Personal (Your Setup)
```
Your Mac (browser) ──HTTP──▶ Hetzner VPS
                              ├── nginx (serves dashboard HTML)
                              ├── agent-bridge (Node.js process)
                              └── Claude Code sessions (agents)
```

### OSS (Cloud)
```
Users (browser) ──HTTPS──▶ Vercel (React dashboard)
                              │
                              ▼
                          Supabase Cloud (database + auth + realtime)
                              │
                              ▼
                          User's VPS(s) (bridge + agents)
```

### OSS (Self-Hosted)
```
Users (browser) ──HTTPS──▶ User's server (React dashboard)
                              │
                              ▼
                          Self-hosted Supabase (docker-compose)
                              │
                              ▼
                          User's VPS(s) (bridge + agents)
```

---

## 10. File & Directory Conventions

### VPS Bridge Directory
```
~/.agent-mc/
├── commands/           # Dashboard → Bridge commands
│   ├── cmd_<uuid>.json
│   └── .processed/
├── state/              # Bridge → Dashboard state
│   ├── dashboard_state.json
│   ├── agents/
│   └── heartbeat.json
├── logs/               # Append-only audit trail
│   └── audit_<date>.jsonl
├── worktrees/          # Git worktrees per agent
├── config.json         # Bridge configuration
└── .session_token      # Auth token for command validation
```

### Project Repository
```
agent-mission-control/
├── dashboard/          # MVP single-file dashboard
│   ├── index.html
│   ├── agent_state.json
│   └── hooks/
├── app/                # OSS React dashboard
│   ├── src/
│   ├── package.json
│   └── vercel.json
├── bridge/             # Hybrid Bridge
│   ├── src/
│   └── package.json
├── bridge-remote/      # Lightweight remote bridge
│   ├── src/
│   └── package.json
├── mcp-server/         # MCP server for Claude Code
│   ├── src/
│   └── package.json
├── supabase/           # Database migrations
│   └── migrations/
├── docs/               # Architecture, backlog, security
└── README.md
```

---

## 11. Data Flow

### Agent Status Update (Bridge → Dashboard)
1. Bridge health check loop reads Claude Code session data
2. Bridge writes `dashboard_state.json` and per-agent state files
3. Bridge pushes update to Supabase `agents` table (if configured)
4. Supabase Realtime broadcasts change to subscribed dashboards
5. Dashboard updates agent card in < 1 second

### Task Approval (Dashboard → Agent)
1. User clicks "✓ Approve" on Kanban card
2. Dashboard writes to Supabase `kanban_tasks` (column_name: 'todo', approved: true)
3. Dashboard logs approval event to `events` table
4. Bridge picks up change via Supabase sync or filesystem command
5. Bridge instructs agent to begin approved work

### Cost Budget Exceeded
1. Agent reports cost via MCP `mc_report_cost`
2. Bridge updates `agents.cost_cents` in Supabase
3. Database trigger `check_agent_budget()` fires
4. If over budget: status set to 'budget_exceeded', event auto-logged
5. Dashboard shows budget alert badge on agent card
6. Agent receives 'budget_exceeded' response on next MCP call

---

## 12. Acceptance Criteria (Global)

- [ ] MVP dashboard accessible via web browser from any device
- [ ] Mobile view works on iPhone/Android with touch-friendly controls
- [ ] Approval actions executable from mobile
- [ ] Real-time updates reflect in < 1 second
- [ ] Budget enforcement works at database level (no client-side bypass)
- [ ] Events table is truly append-only
- [ ] All agent data isolated per user via RLS
- [ ] Bridge has zero network listeners
- [ ] System works fully offline (Supabase optional for MVP)
- [ ] Dark mission-control aesthetic consistent across all screen sizes
