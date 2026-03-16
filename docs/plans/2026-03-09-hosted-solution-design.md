# Hosted Solution Design — Agent Mission Control

**Date**: 2026-03-09
**Status**: Approved
**Branch**: `feature/hosted-solution`

## Context

Agent Mission Control is a real-time dashboard for monitoring Claude Code agent teams. It is currently a single HTML file (799 lines, 44KB) with zero dependencies, served locally via `python3 -m http.server`. The goal is to make it a hosted web application accessible from any browser/device.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Use case | Personal cloud dashboard | One user, one instance, accessible anywhere |
| Frontend | Next.js 14 App Router + Tailwind | Production-grade, TypeScript, component-based |
| Backend | Supabase (PostgreSQL + Realtime + Edge Functions) | Free tier, real-time subscriptions, managed |
| Hosting | Vercel (auto-deploy from git) | Free tier, integrated with Next.js |
| Data push | Claude Code hook (`postToolCall`) + HTTP POST | Automatic, zero manual effort once configured |
| Auth | Deferred (none initially) | Ship fast, add Supabase Auth later |
| Drag-and-drop | Native HTML5 | No library dependency, matches current implementation |
| State management | Zustand (UI) + Supabase Realtime (data) | Minimal, fast, no boilerplate |

## System Architecture

```
YOUR MACHINE
  Claude Code sessions → postToolCall hook → push-state.sh
                                              │ HTTPS POST
                                              ▼
SUPABASE
  Edge Function /ingest-state → PostgreSQL (sessions + session_events)
                                     │ Realtime WebSocket
                                     ▼
VERCEL
  Next.js App ← Supabase Realtime subscription
       │
       ▼
  Any browser (📱 💻 🖥️)
```

## Data Model

### `sessions` table

| Column | Type | Notes |
|---|---|---|
| id | TEXT PRIMARY KEY | e.g., 'ce-africa-valuation' |
| project | TEXT NOT NULL | Display name |
| state | JSONB NOT NULL | Full agent_state.json blob |
| updated_at | TIMESTAMPTZ | Auto-updated on each push |
| created_at | TIMESTAMPTZ | Initial creation |

### `session_events` table (append-only history)

| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | Auto-increment |
| session_id | TEXT FK → sessions | Links to session |
| event_type | TEXT NOT NULL | 'state_update', 'approval', 'drag' |
| payload | JSONB | Event data |
| created_at | TIMESTAMPTZ | Timestamp |

Realtime enabled on `sessions` table via `ALTER PUBLICATION supabase_realtime ADD TABLE sessions`.

### Why JSONB blob?

- The agent_state.json schema is already well-defined and working
- Hook pushes the entire blob — no mapping needed
- Dashboard reads the entire blob — no joins needed
- JSONB is queryable if filtering is needed later
- Migration path: normalize later if query patterns demand it

## Data Flow

### 1. Push (Agent → DB)

Claude Code `postToolCall` hook runs `push-state.sh`:
- Reads `agent_state.json` from project directory
- POSTs to Supabase Edge Function with service_role key in Authorization header
- Edge Function validates, upserts into `sessions`, appends to `session_events`

### 2. Subscribe (DB → Dashboard)

Next.js app subscribes to `sessions` table via Supabase Realtime:
- WebSocket connection established on page load
- INSERT/UPDATE events trigger React re-render
- Zustand stores UI state (panes, active session, screen profile)

### 3. Approval (Dashboard → DB)

User clicks Allow/Deny on Kanban card:
- Zustand updates local state immediately (optimistic)
- Supabase client UPDATEs the session's state JSONB
- Realtime broadcasts the change

## Component Architecture

```
App Layout
├── TopBar
│   ├── BrandLogo
│   ├── SessionTabs          ← Supabase query: all sessions
│   ├── ScreenPicker         ← laptop / desktop / ultrawide
│   ├── TilePicker           ← 1-4 pane grid icons
│   ├── ConnectionStatus     ← Supabase Realtime health
│   └── Clock
├── TilingManager            ← CSS Grid, responsive
│   └── Pane[] (1-4)
│       ├── PaneHeader (session + view selector)
│       ├── AgentView
│       │   ├── ProgressRing (SVG)
│       │   ├── PipelineStages
│       │   ├── AgentCardGrid → AgentCard[]
│       │   └── ActivityFeed → EventRow[]
│       └── KanbanBoard
│           └── KanbanColumn[] → KanbanCard[]
└── FileWatchBar (legacy, hidden)
```

### Tech Choices

| Concern | Choice |
|---|---|
| Styling | Tailwind CSS (design tokens from current CSS vars) |
| Drag-and-drop | Native HTML5 |
| SVG | Inline React SVG (JSX) |
| State | Zustand (UI) + Supabase Realtime (data) |
| Fonts | Geist Sans + Mono via next/font |

## Project Structure

```
agent-mission-control/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/health/route.ts
│   ├── components/
│   │   ├── top-bar/
│   │   ├── tiling/
│   │   ├── agent-view/
│   │   ├── kanban/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/ (client.ts, server.ts, realtime.ts)
│   │   ├── types.ts
│   │   └── constants.ts
│   └── stores/
│       └── ui-store.ts
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── functions/ingest-state/index.ts
├── scripts/push-state.sh
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

## Edge Function: `/ingest-state`

- Auth: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- Validates state schema (requires project, agents array)
- Upserts into `sessions` table
- Appends to `session_events` table
- Returns 200 OK or appropriate error

## Claude Code Hook: `push-state.sh`

- Reads `agent_state.json` from current directory
- Derives session_id from directory name (or `AMC_SESSION_ID` env var)
- POSTs to Edge Function with service_role key
- Exits silently if no agent_state.json found

## Environment Variables

### Vercel (frontend)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (read access) |

### Local (Claude Code hook)

| Variable | Purpose |
|---|---|
| `AMC_API_URL` | Supabase Edge Function base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (write access) |
| `AMC_SESSION_ID` | Optional override for session ID |

## Future Enhancements (deferred)

- Supabase Auth with magic link (single user)
- Row-Level Security
- Event timeline/replay from session_events
- Mobile-responsive layout
- Notification system (agent errors, task completions)
