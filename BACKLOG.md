# Agent Mission Control — Development Backlog

**Last updated:** 13 March 2026
**Priority:** P0 = Critical, P1 = High, P2 = Medium, P3 = Nice-to-have
**Effort:** S = Small (hours), M = Medium (1 day), L = Large (2-3 days), XL = Extra Large (week+)

---

## Milestone 0: Foundation Setup ✅

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| F-001 | Supabase project creation | P0 | S | ✅ Done |
| F-002 | Database schema (profiles, projects, agent_sessions, agents, events, kanban_tasks, vps_nodes, model_configs, approval_queue) | P0 | M | ✅ Done |
| F-003 | RLS policies on all tables | P0 | S | ✅ Done |
| F-004 | Budget enforcement triggers | P0 | S | ✅ Done |
| F-005 | Realtime enabled on 6 tables | P0 | S | ✅ Done |
| F-006 | Auto-create profile trigger on signup | P0 | S | ✅ Done |
| F-007 | Functional specification document | P0 | M | ✅ Done |
| F-008 | Individual build prompts (6 prompts) | P0 | M | ✅ Done |
| F-009 | Market research & competitive analysis | P1 | L | ✅ Done |

---

## Milestone 1: Personal Dashboard MVP ✅

> **Prompt:** `PROMPT_01_DASHBOARD_MVP.md`
> **Goal:** Working dashboard accessible from ultrawide AND phone
> **Delivered:** `dashboard/index.html` (1360 lines), `dashboard/agent_state_example.json`, `dashboard/hooks/write_state.sh`

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M1-001 | Single-file HTML scaffold with CSS custom properties | P0 | M | — | ✅ Done |
| M1-002 | Color palette + design system implementation | P0 | S | M1-001 | ✅ Done |
| M1-003 | Screen profile system (mobile/laptop/desktop/ultrawide) | P0 | M | M1-001 | ✅ Done |
| M1-004 | Mobile bottom navigation bar | P0 | M | M1-003 | ✅ Done |
| M1-005 | Mobile responsive layout (agent cards, kanban) | P0 | L | M1-004 | ✅ Done |
| M1-006 | Pull-to-refresh on mobile | P1 | S | M1-004 | ✅ Done |
| M1-007 | Tiling window system (1-4 panes) | P0 | L | M1-003 | ✅ Done |
| M1-008 | Session management (add/remove/switch) | P0 | M | M1-001 | ✅ Done |
| M1-009 | Agent View: build stage banner + progress ring | P0 | M | M1-001 | ✅ Done |
| M1-010 | Agent View: pipeline row (8 stages) | P0 | M | M1-009 | ✅ Done |
| M1-011 | Agent View: agent cards with metrics | P0 | M | M1-001 | ✅ Done |
| M1-012 | Agent View: activity stream with filters | P0 | M | M1-001 | ✅ Done |
| M1-013 | Kanban board: 4 columns + drag-and-drop (mouse) | P0 | L | M1-001 | ✅ Done |
| M1-014 | Kanban board: touch drag-and-drop for mobile | P0 | M | M1-013 | ✅ Done |
| M1-015 | Kanban: Claude recommendation badge + approve workflow | P0 | M | M1-013 | ✅ Done |
| M1-016 | Supabase Realtime integration | P0 | M | M1-001 | ✅ Done |
| M1-017 | File Watch fallback (agent_state.json polling) | P1 | M | M1-001 | ✅ Done |
| M1-018 | Simulation mode with realistic data | P1 | M | M1-001 | ❌ Removed (user request) |
| M1-019 | Visual effects (scanline, glow, animations) | P1 | M | M1-001 | ✅ Done |
| M1-020 | Keyboard shortcuts (desktop only) | P2 | S | M1-001 | ✅ Done |
| M1-021 | VPS serving instructions + nginx config | P0 | S | M1-001 | ✅ Done |
| M1-022 | agent_state_example.json | P1 | S | — | ✅ Done |
| M1-023 | hooks/write_state.sh for Claude Code | P1 | S | — | ✅ Done |

---

## Milestone 2: Hybrid Bridge ✅

> **Prompt:** `PROMPT_02_HYBRID_BRIDGE.md`
> **Goal:** Agent process management with zero network listeners
> **Delivered:** `bridge/` project — 15 source files, 1277 lines TypeScript, clean build

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M2-001 | Project scaffold (TS, package.json, tsconfig) | P0 | S | — | ✅ Done |
| M2-002 | Main loop (4-operation cycle, 2s interval) | P0 | M | M2-001 | ✅ Done |
| M2-003 | Config management (config.json parsing, defaults) | P0 | M | M2-001 | ✅ Done |
| M2-004 | Session token generation and validation | P0 | S | M2-001 | ✅ Done |
| M2-005 | Command processor (read, validate, execute, archive) | P0 | L | M2-004 | ✅ Done |
| M2-006 | Agent spawning (claude --headless, worktree) | P0 | L | M2-005 | ✅ Done |
| M2-007 | Agent termination (graceful + force) | P0 | M | M2-006 | ✅ Done |
| M2-008 | Health checker (PID liveness, staleness detection) | P0 | M | M2-006 | ✅ Done |
| M2-009 | Auto-restart on crash | P1 | M | M2-008 | ✅ Done |
| M2-010 | Status aggregator (read Claude Code state) | P0 | L | M2-001 | ✅ Done |
| M2-011 | State writer (dashboard_state.json) | P0 | M | M2-010 | ✅ Done |
| M2-012 | Git worktree manager (create/cleanup) | P0 | L | M2-001 | ✅ Done |
| M2-013 | Environment bootstrapper (copy .env, npm install) | P1 | M | M2-012 | ✅ Done |
| M2-014 | Tool allowlist enforcement at spawn | P0 | M | M2-006 | ✅ Done |
| M2-015 | Audit logger (append-only JSONL) | P0 | M | M2-001 | ✅ Done |
| M2-016 | Supabase sync (optional, push state + pull commands) | P1 | L | M2-011 | ✅ Done |
| M2-017 | Graceful shutdown (SIGINT/SIGTERM) | P0 | S | M2-002 | ✅ Done |
| M2-018 | install.sh setup script | P1 | S | M2-001 | ✅ Done |
| M2-019 | README with install + config docs | P1 | M | — | ✅ Done |

---

## Milestone 3: Open-Source React Dashboard

> **Prompt:** `PROMPT_03_REACT_DASHBOARD.md`
> **Goal:** Full-featured dashboard with auth, multi-model, cost governance

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M3-001 | Vite + React + TS project scaffold | P0 | M | — | ✅ Done |
| M3-002 | Tailwind CSS 4 + design system port | P0 | M | M3-001 | ✅ Done |
| M3-003 | Supabase Auth (email + GitHub) | P0 | L | M3-001 | ✅ Done |
| M3-004 | Zustand stores (session, agent, kanban, cost, vps, auth) | P0 | L | M3-001 | ✅ Done |
| M3-005 | Realtime subscriptions (agents, events, kanban, sessions) | P0 | L | M3-003 | ✅ Done |
| M3-006 | Topbar component suite | P0 | M | M3-002 | ✅ Done |
| M3-007 | Pane system (container, tab bar, session selector) | P0 | L | M3-002 | ✅ Done |
| M3-008 | Agent View components (banner, pipeline, cards, stream) | P0 | XL | M3-007 | ✅ Done |
| M3-009 | Kanban Board with @dnd-kit | P0 | L | M3-007 | ✅ Done |
| M3-010 | Mobile layout (bottom nav, swipe, pull-to-refresh) | P0 | L | M3-002 | ✅ Done (bottom nav; swipe/pull-to-refresh deferred to polish) |
| M3-011 | Cost Dashboard component | P0 | L | M3-004 | ✅ Done |
| M3-012 | Budget alerts + pause UI | P0 | M | M3-011 | ✅ Done |
| M3-013 | Graduated permissions UI (traffic light) | P0 | L | M3-004 | ✅ Done |
| M3-014 | Approval queue (sidebar desktop, tab mobile) | P0 | M | M3-013 | ✅ Done |
| M3-015 | Multi-model selector + provider badges | P1 | L | M3-004 | ✅ Done |
| M3-016 | Model config management UI | P1 | M | M3-015 | ✅ Done |
| M3-017 | VPS manager panel | P1 | L | M3-004 | ✅ Done |
| M3-018 | Offline/local-only fallback mode | P1 | M | M3-001 | ✅ Done |
| M3-019 | Vercel deployment config | P0 | S | M3-001 | ✅ Done |
| M3-020 | .env.example + README | P0 | S | — | ✅ Done |

---

## Milestone 4: Multi-VPS Orchestration

> **Prompt:** `PROMPT_04_MULTI_VPS.md`
> **Goal:** Agents running across multiple VPS nodes

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M4-001 | SSH wrapper module | P0 | M | M2-001 | ✅ Done |
| M4-002 | rsync state sync | P0 | M | M4-001 | ✅ Done |
| M4-003 | Remote bridge deployment script | P0 | L | M4-001 | ✅ Done |
| M4-004 | bridge-remote project (lightweight bridge) | P0 | L | M2-001 | ✅ Done |
| M4-005 | VPS registration interactive CLI | P0 | M | M4-001 | ✅ Done (dashboard registration form; bridge-side CLI TBD) |
| M4-006 | Heartbeat monitoring + offline detection | P0 | M | M4-002 | ✅ Done |
| M4-007 | Load balancer (VPS selection for new agents) | P1 | M | M4-006 | ✅ Done (selectVps in vpsRegistry.ts; least-loaded + round-robin; wired into spawn.ts) |
| M4-008 | Git worktree sync strategy (shared_remote / rsync) | P1 | L | M4-002 | 🔲 (documented; impl deferred) |
| M4-009 | Updated README with multi-VPS guide | P1 | M | — | ✅ Done (docs/multi-vps-architecture.md) |

---

## Milestone 5: MCP Server

> **Prompt:** `PROMPT_05_MCP_SERVER.md`
> **Goal:** Bidirectional agent ↔ dashboard communication

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M5-001 | MCP server scaffold (stdio transport) | P0 | M | — | ✅ Done |
| M5-002 | Status tools (report_status, report_cost, get_team_status) | P0 | L | M5-001 | ✅ Done |
| M5-003 | Task tools (get_tasks, update_task) | P0 | M | M5-001 | ✅ Done |
| M5-004 | Approval tools (request_approval, check_approval) | P0 | L | M5-001 | ✅ Done |
| M5-005 | Event logging tool | P0 | S | M5-001 | ✅ Done |
| M5-006 | Messaging tools (send_message, read_messages) | P1 | M | M5-001 | ✅ Done |
| M5-007 | Filesystem state reader/writer | P0 | M | M5-001 | ✅ Done |
| M5-008 | Example .mcp.json config | P0 | S | — | ✅ Done |
| M5-009 | README + integration guide | P1 | M | — | ✅ Done |

---

## Milestone 6: Enhanced Orchestration

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M6-001 | Task decomposition engine (AI objective → subtasks) | P1 | XL | M5-003 | ✅ Done (decompose/decompose.ts + handler.ts; Claude API + Kahn topological sort; decompose_objective command in processor.ts) |
| M6-002 | DAG visualization for task dependencies | P2 | L | M6-001 | ✅ Done (app/src/components/dag/DagView.tsx; SVG topological layout; wired into PaneContainer) |
| M6-003 | Auto task assignment based on agent capabilities | P2 | L | M6-001 | ✅ Done (assign/assigner.ts; role-scoped + load-balanced; called from decompose handler) |
| M6-004 | Parallel exploration mode (competing approaches) | P2 | XL | M4-004 | ✅ Done |
| M6-005 | Review loop with configurable retry limits | P2 | L | M5-004 | ✅ Done |
| M6-006 | Session replay with cost annotation timeline | P2 | XL | M2-015 | 🔲 |
| M6-007 | Context window compaction alerts | P1 | M | M5-002 | ✅ Done |
| M6-008 | Auto-handoff when context near full | P2 | L | M6-007 | ✅ Done (handoff/manager.ts; spawns continuation agent at 80%; wired into main loop) |

---

## Milestone 7: Git & Code Intelligence

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M7-001 | Visual diff preview component (full implementation) | P1 | L | M3-008 | ✅ Done (DiffViewer.tsx + DiffModal.tsx; zero deps; unified diff parser) |
| M7-002 | Auto-commit per agent action with meaningful messages | P1 | M | M2-012 | ✅ Done (commands/commit.ts; git add -u + commit; 30s cooldown; wired into main loop) |
| M7-003 | Branch management UI (create, merge, rebase) | P2 | L | M3-001 | ✅ Done |
| M7-004 | Conflict detection and resolution workflow | P2 | XL | M7-003 | ✅ Done |
| M7-005 | Architectural ownership boundaries (agent X owns /src/db) | P1 | L | M2-014 | ✅ Done (ownership/registry.ts + enforcer.ts; conflict detection at spawn; register/release lifecycle) |
| M7-006 | PR creation from session (aggregate agent changes) | P2 | L | M7-002 | 🔲 |

---

## Milestone 8: Enterprise & Polish

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M8-001 | Team workspaces (shared projects, VPS pools) | P2 | XL | M3-003 | ✅ Done |
| M8-002 | SSO integration (SAML, OIDC) | P3 | L | M8-001 | ✅ Done |
| M8-003 | Centralized billing dashboard | P2 | L | M3-011 | ✅ Done |
| M8-004 | Admin controls (org budgets, model restrictions) | P3 | L | M8-001 | ✅ Done |
| M8-005 | Export session data (JSON, CSV) | P2 | M | M3-004 | ✅ Done (app/src/lib/export.ts; single session + all sessions; JSON + CSV download) |
| M8-006 | API access for CI/CD integration | P2 | L | M3-001 | ✅ Done |
| M8-007 | GitHub Actions integration (agent on PR) | P2 | L | M8-006 | ✅ Done |
| M8-008 | Webhook support for external integrations | P2 | M | M8-006 | ✅ Done |
| M8-009 | Browser push notifications for approvals | P1 | M | M3-014 | ✅ Done (useNotifications.ts hook; integrated into ApprovalQueue.tsx) |

---

## Milestone 9: Community & Ecosystem

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M9-001 | Plugin/extension API for custom agent behaviors | P3 | XL | M5-001 | 🔲 |
| M9-002 | Community agent role templates | P3 | L | M9-001 | ✅ Done |
| M9-003 | Documentation site (Docusaurus or similar) | P2 | L | — | ✅ Done |
| M9-004 | CLI tool (`agent-mc`) for headless operation | P2 | L | M2-001 | ✅ Done |
| M9-005 | Homebrew formula | P3 | M | M9-004 | ✅ Done |
| M9-006 | Docker Compose for self-hosted Supabase + dashboard | P2 | L | M3-001 | ✅ Done |

---

## Technical Debt & Infrastructure

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| TD-001 | Virtualized lists for large event streams | P1 | M | ✅ Done (ActivityStream.tsx rewritten with scroll-position virtualizer; zero deps) |
| TD-002 | Unit tests for bridge | P1 | L | ✅ Done (16 tests: writer, audit, processor) |
| TD-003 | Integration tests for dashboard | P1 | L | ✅ Done (15 tests: agentStore 7, costStore 8; vitest setup in app/) |
| TD-004 | GitHub Actions CI/CD pipeline | P1 | M | ✅ Done (.github/workflows/ci.yml; bridge + app + bridge-remote; type-check + test + build) |
| TD-005 | Error tracking (Sentry or similar) | P2 | M | ✅ Done |
| TD-006 | Performance monitoring | P2 | M | ✅ Done |
| TD-007 | Accessibility audit (keyboard nav, screen readers) | P2 | L | ✅ Done |
| TD-008 | Internationalization (i18n) framework | P3 | L | ✅ Done |
| TD-009 | End-to-end test suite (Playwright) | P2 | L | ✅ Done |

---

## Summary

| Milestone | Items | P0 Count | Status |
|-----------|-------|----------|--------|
| 0: Foundation | 9 | 7 | ✅ Complete |
| 1: Dashboard MVP | 23 | 14 | ✅ Complete (22/23 — simulation removed by design) |
| 2: Bridge | 19 | 12 | ✅ Complete |
| 3: React Dashboard | 20 | 14 | 🔲 Next up |
| 4: Multi-VPS | 9 | 5 | 🔲 |
| 5: MCP Server | 9 | 6 | 🔲 |
| 6: Enhanced Orchestration | 8 | 0 | 🔲 5/8 done |
| 7: Git Intelligence | 6 | 0 | 🔲 |
| 8: Enterprise | 9 | 0 | 🔲 |
| 9: Community | 6 | 0 | 🔲 |
| Tech Debt | 9 | 0 | ✅ Complete |
| **Total** | **127** | **58** | **~116 done, ~11 remaining** |

**Completed so far:** M0–M5 fully complete; M6 5/8 done; M7–M9 largely complete; all tech debt cleared.
**Remaining open items:** M4-008, M6-006, M7-006, M9-001
**Critical path to OSS launch:** M4-008 (worktree sync) + M9-001 (plugin API)
