# PROMPT 03: Open-Source React Dashboard

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first. Supabase schema is deployed. Bridge protocol from Prompt 02 is defined.
> **Deliverables:** Complete `app/` React project
> **Estimated effort:** 2-3 Claude Code sessions (or 1 agent team: lead + frontend + backend)

---

## Objective

Build the open-source React dashboard — deployed via Vercel, backed by Supabase, supporting multiple LLM providers, per-agent cost governance, graduated permission controls, multi-VPS management, and full mobile responsiveness.

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS 4 with CSS custom properties (dark mission-control design)
- **State:** Zustand for client, Supabase Realtime for server
- **Auth:** Supabase Auth (email + GitHub OAuth)
- **Deployment:** Vercel
- **Supabase project:** `zpsnbogldtepmfwgqarz`

## Design System

Port the EXACT visual design from Prompt 01. Same color palette, typography (JetBrains Mono + DM Sans), dark industrial aesthetic. Pixel-identical look and feel.

All 4 screen profiles: Mobile / Laptop / Desktop / Ultrawide. Mobile layout with bottom nav bar (Agents / Kanban / Costs / Approvals).

## Project Structure

```
app/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── topbar/          # Topbar, SessionTabs, ScreenPicker, TilePicker, LiveClock
│   │   ├── mobile/          # BottomNav, MobileMenu, SwipeContainer, PullToRefresh
│   │   ├── panes/           # PaneContainer, PaneTabBar, SessionSelector
│   │   ├── agents/          # AgentView, BuildBanner, PipelineRow, AgentCard, ActivityStream
│   │   ├── kanban/          # KanbanBoard, KanbanColumn, KanbanCard, ApprovalBadge
│   │   ├── cost/            # CostDashboard, AgentCostBar, BudgetAlert, SessionCostSummary
│   │   ├── permissions/     # PermissionGate, RiskBadge, ApprovalQueue
│   │   ├── vps/             # VPSManager, VPSCard, VPSHealthBadge
│   │   ├── models/          # ModelSelector, ModelConfig, ProviderBadge
│   │   ├── auth/            # LoginPage, AuthGuard, ProfileMenu
│   │   └── shared/          # ProgressRing, StatusBadge, GlowBorder
│   ├── stores/
│   │   ├── sessionStore.ts  # Sessions, panes, layout
│   │   ├── agentStore.ts    # Agent states, metrics
│   │   ├── kanbanStore.ts   # Tasks, drag state
│   │   ├── costStore.ts     # Budgets, spending
│   │   ├── vpsStore.ts      # VPS nodes
│   │   └── authStore.ts     # Auth state
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client + realtime
│   │   ├── realtime.ts      # Subscription management
│   │   └── cost.ts          # Cost calculation per model
│   ├── hooks/
│   │   ├── useRealtimeAgents.ts
│   │   ├── useRealtimeEvents.ts
│   │   ├── useRealtimeKanban.ts
│   │   ├── useCostTracking.ts
│   │   ├── useScreenProfile.ts
│   │   └── useKeyboardShortcuts.ts
│   └── types/
│       └── index.ts
├── public/
├── tailwind.config.ts
├── vite.config.ts
├── vercel.json
├── package.json
├── .env.example
└── README.md
```

## Features Beyond MVP

### Multi-Model Support
- `ModelSelector` component: assign different LLM per agent role
- Providers: Claude, OpenAI, Gemini, Ollama, custom endpoints
- Model config stored in `model_configs` Supabase table
- Provider badge on each agent card
- Cost tracking adapts per model's token pricing

### Cost Governance
- `CostDashboard` component (💰 tab in each pane, also in mobile bottom nav)
- Per-agent cost bar chart
- Session total vs budget limit (progress bar)
- Burn rate indicator ($/hour, extrapolated from last 5 min)
- Budget alerts at 80% (yellow) and 95% (red)
- "Pause Agent" button when approaching limit

### Graduated Permissions (Traffic Light)
- 🟢 Auto-approve: reads, grep, glob, tests
- 🟡 Review recommended: file writes in scope, deps changes
- 🔴 Mandatory approval: destructive ops, out-of-scope, credentials
- `ApprovalQueue` sidebar (desktop) / tab (mobile)
- Each pending action: agent name, description, risk level, files, approve/reject buttons
- Rejection logs to audit trail with reason

### Multi-VPS Management
- `VPSManager` (🖥️ VPS button in topbar)
- Node list with health (green/amber/red)
- Heartbeat + system metrics
- Agent count vs capacity
- Session → VPS assignment dropdown

### Authentication
1. Supabase Auth (email + GitHub OAuth)
2. Profile auto-created via DB trigger
3. All queries use JWT → RLS enforces isolation
4. Realtime subscriptions filtered to user's sessions

### Offline / Local-Only Mode
If no Supabase URL configured, falls back to reading `dashboard_state.json` from bridge output directory.

## Mobile-Specific React Components

### `BottomNav.tsx`
Fixed bottom bar with 4 tabs: Agents | Kanban | Costs | Approvals. Badge count on Approvals for pending items.

### `SwipeContainer.tsx`
Horizontal swipe to switch between sessions. Uses touch events with velocity-based snap.

### `PullToRefresh.tsx`
Pull-down gesture triggers manual data refresh. Shows spinner during refresh.

### `MobileMenu.tsx`
Hamburger slide-out: session list, screen override, settings, logout.

### `MobileKanban.tsx`
Columns as horizontal scroll cards or vertical accordions. Touch-friendly drag-and-drop using `@dnd-kit/core`.

## Deliverables

1. Complete React project with all components
2. Supabase integration with realtime subscriptions
3. Multi-model configuration UI
4. Cost dashboard with budget governance
5. Graduated permission UI
6. VPS management panel
7. Full mobile responsive layout
8. Auth flow (login, signup, profile)
9. `vercel.json` deployment config
10. `.env.example` with all variables
11. `README.md` with setup, deploy, contribute instructions

## Acceptance Criteria

- [ ] Visual design matches MVP aesthetic exactly
- [ ] All 4 screen profiles work (mobile/laptop/desktop/ultrawide)
- [ ] Mobile bottom nav with all 4 tabs functional
- [ ] Touch-friendly approval buttons on mobile
- [ ] Supabase Auth with GitHub OAuth
- [ ] Realtime updates < 1 second
- [ ] Multi-model selector shows all configured providers
- [ ] Cost dashboard with per-agent spending and budget bars
- [ ] Graduated permissions with traffic light badges
- [ ] Approval queue surfaces pending actions
- [ ] VPS manager shows node health and capacity
- [ ] Offline mode with local JSON fallback
- [ ] Deploys to Vercel with `vercel deploy`
