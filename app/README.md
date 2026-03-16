# Agent Mission Control — React Dashboard

Open-source React dashboard for monitoring and orchestrating teams of AI coding agents (Claude Code) running across git worktrees.

## Features

- **Real-time agent monitoring** — live status, context usage, cost tracking per agent
- **Kanban board** — drag-and-drop task management with @dnd-kit, touch-friendly
- **Approval queue** — graduated permissions (🟢🟡🔴) with approve/reject workflow
- **Cost governance** — per-agent spend bars, session budget limits, burn rate, pause alerts
- **Multi-model support** — Anthropic, OpenAI, Google, Ollama, custom endpoints
- **VPS manager** — node health, agent capacity, system metrics
- **Auth** — Supabase email + GitHub OAuth, RLS-enforced data isolation
- **Offline fallback** — polls `dashboard_state.json` from bridge when Supabase unavailable
- **4 screen profiles** — mobile / laptop / desktop / ultrawide
- **Mobile bottom nav** — Agents | Kanban | Costs | Approvals with badge counts

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes* | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes* | Your Supabase anon (public) key |
| `VITE_BRIDGE_STATE_PATH` | No | URL to `dashboard_state.json` for offline mode |

*Required unless using offline/local mode only.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

The included `vercel.json` handles SPA routing. Set env vars in the Vercel dashboard.

## Project Structure

```
src/
├── components/
│   ├── topbar/       Topbar, session tabs, tile/screen pickers, clock
│   ├── mobile/       BottomNav for mobile layout
│   ├── panes/        PaneContainer, PaneTabBar — tiling window system
│   ├── agents/       AgentView, BuildBanner, AgentCard, ActivityStream
│   ├── kanban/       KanbanBoard, KanbanColumn, KanbanCard
│   ├── cost/         CostDashboard with budget bars and alerts
│   ├── permissions/  ApprovalQueue with risk badges
│   ├── vps/          VPSManager panel
│   ├── models/       ModelSelector dropdown
│   ├── auth/         LoginPage, AuthGuard, ProfileMenu
│   └── shared/       ProgressRing, StatusBadge, GlowBorder
├── stores/           Zustand: session, agent, kanban, cost, vps, auth
├── lib/              supabase.ts, realtime.ts, cost.ts
├── hooks/            useRealtimeAgents, useRealtimeKanban, useCostTracking,
│                     useScreenProfile, useKeyboardShortcuts, useOfflineFallback
└── types/index.ts    All domain types
```

## Keyboard Shortcuts (desktop)

| Key | Action |
|-----|--------|
| `1`–`4` | Set pane count |
| `a` | Agents tab |
| `k` | Kanban tab |
| `c` | Costs tab |
| `p` | Approvals tab |
