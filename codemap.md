# Codemap — Agent Mission Control

Generated: 2026-03-13

---

## `mcp-server/` — MCP Server (M5 ✅)

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — creates `McpServer`, registers all 10 tools, connects `StdioServerTransport` |
| `src/config.ts` | Reads `AGENT_MC_*` env vars; exposes derived paths for state, audit log, approvals, inbox |
| `src/state/reader.ts` | `readJsonFile` (with ENOENT fallback), `readJsonDir` (scan a dir of .json files) |
| `src/state/writer.ts` | `writeJsonAtomic` (write-to-tmp → rename), `appendJsonLine` (audit JSONL, append-only) |
| `src/tools/status.ts` | `mc_report_status`, `mc_report_cost`, `mc_get_team_status` |
| `src/tools/tasks.ts` | `mc_get_tasks`, `mc_update_task` (state machine validated) |
| `src/tools/approvals.ts` | `mc_request_approval` (green=auto, yellow=queue, red=block), `mc_check_approval` |
| `src/tools/events.ts` | `mc_log_event` — writes structured JSONL to audit file |
| `src/tools/messaging.ts` | `mc_send_message`, `mc_read_messages` (inbox cleared after read) |
| `.mcp.json.example` | Drop into project root as `.mcp.json` to enable for Claude Code agents |
| `README.md` | Setup, env vars, tool reference, approval risk levels, filesystem layout |

---

## `dashboard/` — MVP Single-File Dashboard

| File | Purpose |
|------|---------|
| `index.html` | Complete dashboard — all HTML, CSS (~600 lines), JS (~700 lines) in one file. Screen profiles, Supabase Realtime, file-watch fallback, tiling panes, kanban, agent cards. |
| `agent_state_example.json` | Example state file shape that the bridge writes to `dashboard_state.json` |
| `hooks/write_state.sh` | Claude Code hook — writes session state to `agent_state.json` on each tool call |

---

## `bridge/` — Orchestration Daemon

### Root
| File | Purpose |
|------|---------|
| `package.json` | `agent-bridge` package, ESM, deps: chokidar, execa, zod, @supabase/supabase-js |
| `tsconfig.json` | Strict TS, ES2022, Node16 module resolution |
| `install.sh` | Setup script: npm install, build, config scaffold |
| `README.md` | Install, config, usage docs |

### `src/`
| File | Purpose |
|------|---------|
| `index.ts` | Entry point. Main 4-step loop (2s interval). Startup, graceful shutdown on SIGINT/SIGTERM. |
| `config.ts` | Config schema (Zod), load from `config.json`, apply defaults |

### `src/audit/`
| File | Purpose |
|------|---------|
| `logger.ts` | Append-only JSONL audit log. `appendFile` only. Format: `{ ts, level, event, agentId?, sessionId?, data? }` |

### `src/commands/`
| File | Purpose |
|------|---------|
| `processor.ts` | Poll `commandDir/` for `cmd-*.json` files, validate schema, route to handler, archive on completion |
| `spawn.ts` | Handle `spawn_agent` command: validate, create worktree, bootstrap env, start Claude Code |
| `terminate.ts` | Handle `terminate_agent`: graceful SIGTERM → wait 5s → SIGKILL |
| `approve.ts` | Handle `approve_action` / `reject_action`: update approval state, unblock waiting agent |

### `src/health/`
| File | Purpose |
|------|---------|
| `checker.ts` | Check PID liveness, detect staleness (no state update > threshold), flag unhealthy agents |
| `recovery.ts` | Auto-restart crashed agents up to configured max retries |

### `src/security/`
| File | Purpose |
|------|---------|
| `token.ts` | `generateToken()` → `crypto.randomBytes(32).toString('hex')`. `validateToken()` for command auth. |
| `permissions.ts` | Tool allowlist enforcement at spawn time. Map agent role → allowed Claude Code tools |

### `src/state/`
| File | Purpose |
|------|---------|
| `aggregator.ts` | Orchestrate state reads from all sources (Claude state files, config, health) into unified snapshot |
| `claude-reader.ts` | Parse Claude Code's `~/.claude/projects/<hash>/` session state files |
| `writer.ts` | Write `dashboard_state.json` using atomic write (`.tmp` → `rename`) |

### `src/supabase/`
| File | Purpose |
|------|---------|
| `client.ts` | Initialize Supabase client (skips if no URL configured) |
| `sync.ts` | Push `dashboard_state` to Supabase `agent_sessions`/`agents` tables; pull pending commands |

### `src/worktree/`
| File | Purpose |
|------|---------|
| `manager.ts` | `git worktree add / remove`. Track active worktrees. Cleanup on agent termination. |
| `bootstrap.ts` | After worktree creation: copy `.env`, run `npm install`, set up Claude Code config |

---

## `app/` — React OSS Dashboard (Milestone 3 — In Progress)

| Path | Purpose |
|------|---------|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Root component, router, auth guard |
| `src/components/` | All UI components (see `.claude/agents/dashboard-agent.md` for full tree) |
| `src/stores/` | Zustand stores: session, agent, kanban, cost, vps, auth |
| `src/lib/supabase.ts` | Supabase client init from `import.meta.env` |
| `src/lib/realtime.ts` | Realtime subscription management, reconnection |
| `src/lib/cost.ts` | Cost calculation per model/provider |
| `src/hooks/` | Custom hooks: useRealtimeAgents, useRealtimeEvents, useRealtimeKanban, useCostTracking, useScreenProfile, useKeyboardShortcuts |
| `src/types/index.ts` | Shared TypeScript types |
| `vite.config.ts` | Vite config |
| `tailwind.config.ts` | Tailwind 4 + CSS custom properties |
| `vercel.json` | Vercel deployment (SPA redirect) |
| `.env.example` | Required env vars (no real values) |

---

## `.claude/` — Claude Code Config

| File | Purpose |
|------|---------|
| `settings.local.json` | Tool permission allowlist for this project |
| `rules/review-gate-extensions.md` | Project-specific review gate rules (credentials, network listeners, audit integrity) |
| `rules/project-conventions.md` | Dashboard vanilla-first, bridge TS strict, JSONL immutability, IPC-only |
| `rules/architecture.md` | 3-layer architecture, invariants, multi-VPS readiness |
| `agents/bridge-agent.md` | Specialist prompt for bridge development |
| `agents/dashboard-agent.md` | Specialist prompt for dashboard development |

---

## `Dashboard-prompts/` — Build Prompts

| File | Milestone |
|------|-----------|
| `PROMPT_01_DASHBOARD_MVP.md` | M1 — Personal Dashboard |
| `PROMPT_02_HYBRID_BRIDGE.md` | M2 — Hybrid Bridge |
| `PROMPT_03_REACT_DASHBOARD.md` | M3 — React Dashboard |
| `PROMPT_04_MULTI_VPS.md` | M4 — Multi-VPS |
| `PROMPT_05_MCP_SERVER.md` | M5 — MCP Server |
| `PROMPT_06_ARCHITECTURE_DOCS.md` | M6+ — Docs |

---

## Supabase Schema (deployed)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, auto-created on signup via DB trigger |
| `projects` | Agent projects (repos, worktree base paths) |
| `agent_sessions` | Active sessions: state, cost, started_at, last_seen |
| `agents` | Individual agent instances within a session |
| `events` | Activity stream: all agent actions with timestamps and costs |
| `kanban_tasks` | Tasks on the kanban board with state machine |
| `vps_nodes` | Registered VPS nodes with health status |
| `model_configs` | Per-user model configuration (provider, model ID, cost rates) |
| `approval_queue` | Pending agent actions awaiting human approval |
