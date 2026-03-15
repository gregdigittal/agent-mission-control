# Agent Mission Control — Backlog

> Last updated: 2026-03-15
> Reference: Production Build Prompt v2.0 (15 March 2026)

## Status Key
- ✅ Done
- ⚠️ Partial
- ❌ Not started

---

## P0 — Must Fix

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-060 | Input sanitization / XSS validation on agent_state.json | ❌ | Validate shape before render; escape agent-supplied text |
| F-070 | MCP server auth — Bearer token on write endpoints | ❌ | CRITICAL security gap; rate limit 60 req/min/key |

---

## P1 — Phase 5 Polish (incomplete)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-004 | First-run screen profile modal | ❌ | Centered overlay on first load; Laptop/Desktop/Ultrawide cards |
| F-005 | Keyboard shortcuts (1-4 layouts, L/D/U profiles) | ❌ | Guard with activeElement check |
| F-051 | Custom scrollbars | ❌ | 5px via `::-webkit-scrollbar`; `scrollbar-width: thin` Firefox |
| F-002 | CSS variable audit — sweep remaining hardcoded px | ⚠️ | Vars used but no exhaustive audit done |
| F-003 | Error handling — inline banners + exponential backoff | ⚠️ | Basic fetch wrapping exists; backoff + banner UI missing |
| F-042 | README — user-facing setup guide | ⚠️ | CLAUDE.md is dev guide; needs user quickstart, schema ref, troubleshooting |

---

## P1 — Hosted Track (Phase 6)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-072 | Docker Compose (app + postgres + mcp-server) | ❌ | Multi-stage Dockerfile, health checks, volume persistence |
| F-073 | CI/CD pipeline — GitHub Actions | ❌ | lint, typecheck, test, build, e2e, deploy to Vercel on main |
| F-074 | Testing framework — Vitest + Playwright | ❌ | Unit + component + E2E; target 60% coverage |

---

## P2 — Nice to Have

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-033 | Per-session data source config (sim/file/url) | ❌ | Each session independently configured |
| F-034 | URL data source mode | ❌ | Remote agent_state.json fetch; CORS documented |
| F-052 | Help tooltip ("?" panel with shortcuts) | ❌ | Floating panel from topbar "?" button |
| F-032 | Auto-detect mode (file vs sim) | ⚠️ | Replaced with explicit FILE/SUPABASE toggle; auto-detect on FILE start possible |

---

## P2+ — Competitive Enhancements (Phase 6)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-063 | Agent heartbeat liveness (<30s green, 30-60s amber, >60s red) | ❌ | Per-agent lastHeartbeat tracking |
| F-064 | Cost tracking widget — total + per-agent + trend | ❌ | Parse from agent metrics.cost; sparkline in topbar |
| F-061 | Evidence gates — block stage advancement without proof | ❌ | minTasksDone + minEvents per stage; human override |
| F-065 | Task dependency DAG — blocked tasks, cycle detection | ❌ | dependsOn[] on KanbanTask; lock icon; dotted lines |

---

## Completed

| ID | Feature |
|----|---------|
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
