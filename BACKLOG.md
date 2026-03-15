# Agent Mission Control — Task Backlog

> Last updated: 2026-03-16 (all P1 + P2 + P2+ complete — full backlog cleared)
> Reference: Production Build Prompt v2.0 (15 March 2026)

**Naming convention:** Items here are *tasks*. Each task maps to a Kanban card in `agent_state.json`.
Task status in the Kanban: `backlog` (To Do) → `in-progress` → `review` → `done`.

## Status Key
- ✅ Done
- ⚠️ Partial
- ❌ Not started (= Kanban status: `backlog`)

---

## P0 — Must Fix

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-060 | Input sanitization / XSS validation on agent_state.json | ✅ | Already implemented: validateState() with enum checks, safeStr, array limits, no innerHTML anywhere |
| F-070 | MCP server auth — Bearer token on write endpoints | ✅ | Token validation against AMC_WRITE_SECRET (or anon key fallback), 60 req/min rate limit, 128KB payload cap, content-type guard. **Deploy:** `supabase functions deploy ingest-state --project-ref zpsnbogldtepmfwgqarz` then `supabase secrets set AMC_WRITE_SECRET=<secret> --project-ref zpsnbogldtepmfwgqarz` |

---

## P1 — Phase 5 Polish

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-004 | First-run screen profile modal | ✅ | Centered overlay on first load; Laptop/Desktop/Ultrawide cards; persists to localStorage |
| F-005 | Keyboard shortcuts (1-4 layouts, L/D/U profiles) | ✅ | Guard with activeElement check; ? toggles help panel |
| F-051 | Custom scrollbars | ✅ | 5px via `::-webkit-scrollbar`; `scrollbar-width: thin` for Firefox |
| F-002 | CSS variable audit — sweep remaining hardcoded px | ✅ | Agent card, agent-top, agent-metrics, kanban-cards, feed-header, feed-item, session-dropdown-item gaps/padding now use --density-gap/--density-pad. Fixed indicator sizes (5-6px dots, scrollbar) remain intentionally hardcoded. |
| F-003 | Error handling — inline banners + exponential backoff | ✅ | Inline banner exists; exponential backoff added to both file watch and Supabase polling (3s→6s→12s…max 60s); retry countdown shown in banner |
| F-042 | README — user-facing setup guide | ✅ | Quickstart, all three modes, full schema reference, screen profiles, keyboard shortcuts, Kanban features, troubleshooting, architecture |

---

## P1 — Hosted Track (Phase 6)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-072 | Docker Compose (app + nginx) | ✅ | Dockerfile (nginx:alpine) + docker-compose.yml; volume mount for File Watch; Supabase relay via hosted project |
| F-073 | CI/CD pipeline — GitHub Actions | ✅ | lint (innerHTML security gate + secret scan) → E2E tests → Docker build → deploy to Vercel on main |
| F-074 | Testing framework — Playwright E2E | ✅ | 13 tests: first-run modal, keyboard shortcuts, help panel, dashboard rendering; webServer auto-starts python http.server |

---

## P2 — Nice to Have

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-052 | Help tooltip ("?" panel with shortcuts) | ✅ | Floating panel from topbar "?" button; `?` key toggles; click-outside closes |

---

## P2+ — Competitive Enhancements (Phase 6)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-063 | Agent heartbeat liveness (<30s green, 30-60s amber, >60s red) | ✅ | `hb-dot` CSS (fresh/stale/dead); falls back to session `_lastUpdate` when no per-agent `lastHeartbeat` |
| F-064 | Cost tracking widget — total + per-agent + trend | ✅ | `renderCostWidget()` aggregates all session agent costs; shows `$x.xx` in topbar; hidden when total is $0.00 |

---

## Completed

| ID | Feature |
|----|---------|
| F-064 | Cost tracking widget — total + per-agent |
| F-063 | Agent heartbeat liveness indicators |
| F-052 | Help tooltip ("?" panel with shortcuts) |
| F-074 | Testing framework — Playwright E2E |
| F-073 | CI/CD pipeline — GitHub Actions |
| F-072 | Docker Compose (app + nginx) |
| F-004 | First-run screen profile modal |
| F-005 | Keyboard shortcuts (1-4 layouts, L/D/U profiles, ?) |
| F-051 | Custom scrollbars |
| F-042 | README — user-facing setup guide |
| F-065 | Task dependency DAG — blocked tasks, cycle detection |
| F-061 | Evidence gates — block stage advancement without proof |
| F-034 | URL data source mode |
| F-033 | Per-session source badge (SIM/FILE/URL/SB) |
| F-001 | JS module refactor (AMC.State, AMC.Data, AMC.Render, AMC.UI) |
| F-010 | Build stage banner (progress ring, stats row) |
| F-011 | Pipeline row (8 stages, completed/active/pending) |
| F-012 | Agent cards (status borders, metrics, emoji avatars) |
| F-013 | Activity stream (filters, feed-in animation, 100-item cap) |
| F-014 | Kanban board (4 columns) |
| F-015 | Kanban recommendation badges + approve workflow |
| F-016 | Drag-and-drop system |
| F-020 | Session management (add, remove, color dots) |
| F-021 | Tiling pane system (1-4 panes, per-pane session + view) |
| F-022 | Screen profile system (14"/27"/49" CSS var cascades) |
| F-023 | Topbar chrome (brand, session tabs, tile/screen picker, clock) |
| F-030 | Simulation engine |
| F-031 | File Watch mode (3s polling) |
| F-040 | agent_state_example.json |
| F-041 | hooks/write_state.sh (with Supabase push) |
| F-050 | Animations (scanline, pulse, glow, feed-in, card hover) |
| F-062 | Connection status indicators (stale/disconnected tooltips) |
| F-071 | Supabase relay (FILE/SUPABASE toggle, _fetchSessions, 60-min window) |
| —   | Global SessionStart hook (amc-session-init.sh auto-creates per-project push hook) |
| —   | Vercel static deploy (agent-mission-control/vercel.json) |
