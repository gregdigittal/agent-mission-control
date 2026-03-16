# Competitive Analysis & Refactoring Prompt: Agent Mission Control v2

## Role

You are a **senior software architect** with deep expertise in developer tooling, real-time dashboards, agent orchestration, and VPC deployment. You have reviewed the source code and documentation of three competing AI agent management tools. Your task is to produce a comprehensive architectural plan for **Agent Mission Control v2** (AMC v2) — grounded entirely in observed features from these tools.

---

## Immutable Requirements

These five requirements **cannot be changed** regardless of what the analysis recommends. Everything else — framework, language, database, hosting, state management, build system — is open to replacement.

| # | Requirement | Details |
|---|-------------|---------|
| 1 | **Concept** | A dashboard for monitoring AND orchestrating Claude Code agent teams |
| 2 | **MCP server** | Agents self-report via MCP tools (stdio transport) |
| 3 | **Design language** | Dark theme, Geist Mono/Sans fonts, cyan/green/amber accents, scanline overlay |
| 4 | **Deployment target** | VPC with remote browser access, Claude Max subscription ($100/mo, no API keys) |
| 5 | **Slack integration** | Users can action Kanban tasks directly from Slack without opening the dashboard |

---

## Priority Weighting

When features or architectural choices conflict, use this priority order:

1. **Reliability** — agents must not lose work, state must persist, processes must recover from crashes
2. **Bidirectional orchestration** — dispatching tasks TO agents is more valuable than passive monitoring
3. **Operational simplicity** — fewer moving parts beat feature richness; a single-binary backend beats a microservices mesh
4. **Developer velocity** — fast iteration for a solo developer (team size: 1) building and maintaining the system
5. **Feature breadth** — nice-to-haves like browser preview and code review come last

---

## Context: Current AMC (Reference Only)

**Current Stack:** Next.js 16, React 19, TypeScript, Zustand 5, Tailwind v4, Supabase (Postgres + Realtime + Edge Functions), Vercel hosting

**Architecture (may be entirely replaced):**
- Single-page dashboard with tiling window manager (1-4 panes)
- Session management with stale detection (5min timeout) and auto-promotion on realtime updates
- Agent View: progress ring, pipeline stage pills, agent cards with status/metrics, scrolling activity feed
- Kanban Board: 4 columns (Backlog -> In Progress -> Review -> Done), HTML5 drag-and-drop, approval badges
- MCP Server (stdio, 7 tools): `amc_report_session`, `amc_create_tasks`, `amc_update_task`, `amc_assign_task`, `amc_request_approval`, `amc_report_metrics`, `amc_push_event`
- Supabase Edge Function (`ingest-state`) handles POST upserts from MCP server
- Global `~/.claude/CLAUDE.md` instructs all Claude Code sessions to self-report

---

## Tools to Analyze

### Tool 1: Vibe Kanban
- **Repo:** https://github.com/BloopAI/vibe-kanban
- **Site:** https://vibekanban.com
- **Stack:** Rust (49%) + TypeScript (47%), PostgreSQL, React, Vite
- **Traction:** 22.9k GitHub stars, 30k+ active users, 100k+ PRs created

**Key features:**
1. Workspace isolation via git worktrees — each task gets its own branch and terminal
2. Built-in browser with DevTools, inspect mode, and device emulation
3. Real-time diff review with inline commenting on AI-generated code
4. Support for 10+ coding agents (Claude Code, Codex, Gemini, Cursor, Amp, etc.)
5. PR creation with AI-generated descriptions
6. Hierarchical issues and sub-issues
7. MCP integration (MCP_HOST/MCP_PORT env vars)
8. Self-hosted cloud deployment via Docker with CORS/tunnel support
9. `npx vibe-kanban` single-command install
10. Direct agent feedback loop without UI context switching

**Architecture note:** Rust backend is a deliberate choice for performance-critical operations (git worktree management, file watching, process orchestration).

### Tool 2: Claw-Kanban
- **Repo:** https://github.com/GreenSheep01201/Claw-Kanban
- **Stack:** Node.js 22+, React 19, Vite, SQLite (node:sqlite), TypeScript
- **UI:** Glassmorphism design

**Key features:**
1. Dual execution model — CLI agents (inherit environment) vs HTTP agents (OAuth)
2. Role-based auto-assignment (DevOps/Backend/Frontend x New/Modify/Bugfix)
3. Six-column Kanban workflow (Inbox -> Planned -> In Progress -> Review/Test -> Done/Stopped)
4. Real-time terminal output visible in browser as agents execute
5. Chat-to-card integration via webhooks (Telegram, Slack)
6. Automatic Claude review cycles on task completion
7. Provider auto-detection (discovers installed CLI tools + auth status)
8. AES-256-GCM encryption for OAuth tokens at rest
9. Multi-language support (auto-detect workspace language)
10. Zero-config for CLI agents — inherits existing MCP servers, skills, and auth

**Architecture note:** Uses Node.js built-in SQLite (`node:sqlite`) for zero-dependency local persistence — no external database service needed.

### Tool 3: Claude Workspace (claude-ws)
- **Repo:** https://github.com/Claude-Workspace/claude-ws
- **Stack:** Next.js 16, React 19, SQLite + Drizzle ORM, Socket.io, Tailwind CSS 4, Radix UI, Zustand
- **Metrics:** 95.9% TypeScript, v0.3.100 (March 2026), 454 commits, 211 stars, MIT license
- **Process management:** PM2 via `ecosystem.config.cjs`
- **Install:** `npx -y claude-ws`, `npm install -g claude-ws`, or from source with pnpm

**Key features:**
1. Real-time streaming via Socket.io (live Claude responses with token-by-token output)
2. Checkpoint system — save and rewind to any conversation state
3. Tabbed CodeMirror editor with syntax highlighting and AI suggestions
4. Full Git integration (status, stage, commit, diff, visual graph)
5. Agent Factory — plugin system for custom skills, commands, agents
6. Secure remote access via Cloudflare Tunnel with API auth key (`API_ACCESS_KEY`)
7. Multiple themes (Light, Dark, VS Code variants, Dracula)
8. Local-first SQLite + Drizzle ORM architecture (no external database needed)
9. PM2 process manager for production deployments with auto-restart
10. Drag-and-drop Kanban with full conversation history per card

**Architecture note:** Closest stack to AMC's current one. Replaces Supabase with local SQLite + Drizzle ORM and adds Socket.io for real-time. PM2 process management and Cloudflare Tunnel remote access are directly relevant to VPC deployment.

**Environment variables:** `PORT` (default 8556), `API_ACCESS_KEY`, `LOG_LEVEL`, `CLAUDE_PATH`, `ANTHROPIC_API_RETRY_TIMES`

---

## Deployment Constraints

### VPC Requirements
- Persistent Linux server (EC2, GCP Compute, Hetzner, DigitalOcean)
- Long-running processes for agent orchestration
- Docker containerization for reproducible deploys
- Reverse proxy (Caddy or Nginx) for HTTPS termination
- Persistent local storage (SQLite or Postgres on-instance)

### Remote Access
- Cloudflare Tunnel or SSH tunneling (no open ports)
- Authentication layer (API key, OAuth, or basic auth)
- Mobile-responsive UI for phone/tablet monitoring
- Claude Code Remote Control (claude.ai/code) for continuing sessions from any device

### Claude Max Subscription (No API Keys)
- Claude Code CLI (`claude`) is the execution interface — not the HTTP API
- Headless automation via `claude --dangerously-skip-permissions` or `--allowedTools`
- Authentication via `claude /login` + credential file transfer to VPC
- No `ANTHROPIC_API_KEY` — all interaction flows through the CLI
- MCP server communicates with Claude Code instances via stdio, not HTTP

### Slack Integration
Users must **action Kanban tasks directly from Slack** without opening the dashboard:
- **Notifications:** Structured messages when agents complete tasks, request approval, encounter errors, or need input
- **Actionable messages:** Block Kit buttons/menus for approving/rejecting recommendations, moving tasks between columns, assigning agents, restarting failed tasks
- **Command interface:** `/amc` slash command or Slack bot for listing sessions, showing task summaries, triggering agent actions
- **Bidirectional sync:** State changes in Slack reflect in dashboard in real-time, and vice versa
- **Thread-based context:** Each task maps to a Slack thread for discussion, approvals, and agent output

Note: Claw-Kanban supports chat-to-card integration via webhooks — evaluate and improve upon their approach.

---

## Deliverables

Produce five sections (A through E). Be specific, cite tool names for every recommendation, and avoid speculation about features not observed in the source code.

### A. Feature Comparison Matrix

A markdown table with **5 columns** (AMC Current | Vibe Kanban | Claw-Kanban | Claude Workspace | Recommended for AMC v2) and **15 rows** — one per category:

| Category | What to compare |
|----------|----------------|
| Task Management | Kanban columns, drag-drop, sub-issues, priorities |
| Agent Orchestration | Multi-agent, role routing, auto-assignment, parallel execution |
| Workspace Isolation | Git worktrees, branch management, safety mechanisms |
| Real-time Monitoring | Terminal output, activity feeds, streaming responses |
| Code Review | Diff view, inline comments, PR generation |
| Built-in Tooling | Browser preview, code editor, DevTools |
| Deployment Model | Local, Docker, cloud, VPC suitability |
| Security | Auth, encryption, token management, credential storage |
| MCP Integration | Server support, tool count, bidirectional capability |
| Claude Max Compatibility | CLI-based operation, no API key requirement |
| Plugin/Extension System | Custom agents, skills, commands |
| Data Architecture | Database type, persistence model, backup strategy |
| Process Management | Spawning, monitoring, terminating agent processes |
| Remote Access | Tunneling method, auth, mobile support |
| Chat/Messaging Integration | Slack, Telegram, webhooks, actionable messages |

In the "Recommended for AMC v2" column, state which tool's approach to adopt (or "Custom" if none suffice), with a one-sentence justification.

### B. Best-of-Breed Selection

For each of the 15 categories above, provide a structured assessment:

```
### [Category Name]
**Winner:** [Tool name] — [one-sentence reason]
**Recommendation:** Adopt / Adapt / Skip / Custom
**Complexity:** Low (<1 week) / Medium (1-3 weeks) / High (3+ weeks)
**Priority:** P0 (blocks all other work) / P1 (needed for MVP) / P2 (post-MVP) / P3 (nice-to-have)
**Notes:** [specific implementation considerations, if any]
```

### C. Architecture Proposal — Clean-Sheet Design

Design the target architecture. **Do not assume the current stack.** For each decision, state what you recommend, what the alternatives were, and why you chose it. Use this framework:

**Stack decisions (justify each with evidence from the three tools):**
1. **Language & runtime** — TypeScript/Node.js, Rust, Go, or hybrid?
2. **Frontend framework** — Next.js, Vite + React, SvelteKit? (Consider: this is a dashboard SPA — does it need SSR?)
3. **Build system** — Vite, Turbopack, esbuild, Webpack?
4. **Database & ORM** — Apply this decision framework:
   - Is the data structured with relationships? → SQL
   - Is an external database service acceptable on VPC? → If no, local SQLite
   - Scale: <10K records (sessions/tasks) → SQLite sufficient
   - Consistency: strong consistency required for task state? → Yes
   - Conclusion: [your recommendation with reasoning]
5. **Real-time layer** — Socket.io, raw WebSocket, Server-Sent Events?
6. **Process management** — PM2, systemd, Docker Compose, custom?

**System design (describe the architecture for each):**
7. **Agent lifecycle** — How Claude Code instances are spawned, monitored, health-checked, and terminated
8. **Workspace isolation** — Git worktree strategy for parallel agent execution with conflict prevention
9. **MCP server evolution** — How the current 7-tool server grows to support bidirectional orchestration (dispatching tasks TO agents, not just receiving reports)
10. **Authentication flow** — How Claude Max credentials flow: user -> VPC -> Claude Code processes
11. **Remote access** — Cloudflare Tunnel + auth middleware + session persistence
12. **Mobile experience** — Responsive breakpoints, touch interactions, condensed views
13. **Plugin system** — Custom agent behaviors, skills, and commands (reference Agent Factory from claude-ws)
14. **Slack integration** — Bidirectional architecture: incoming webhooks for notifications, Block Kit for interactive messages, slash commands for task management, thread-per-task mapping. How this integrates with the real-time layer and Kanban state.
15. **Observability** — Logging, metrics, health checks, and alerting for the VPC-hosted system
16. **CI/CD** — How the app is built, tested, and deployed to the VPC

**Produce an architecture diagram** in Mermaid format showing: frontend, backend, database, MCP server, Claude Code processes, Slack integration, Cloudflare Tunnel, and their connections.

### D. Build Plan

Recommend either **migration** (evolve current codebase) or **greenfield** (new project). State your recommendation and the top 3 reasons why.

Then produce a phased plan. For each phase provide:

| Field | What to include |
|-------|----------------|
| **Goal** | What this phase delivers as a working increment |
| **Key files** | 5-10 most important files to create or modify |
| **Dependencies** | New packages or services introduced |
| **Database changes** | Schema migrations, if any |
| **Effort** | Estimated calendar time for a solo developer |
| **Reuse** | What can be carried from the current AMC codebase |
| **Borrow** | What can be adapted from the three analyzed tools |

Target 4-6 phases, ordered so each phase produces a **deployable increment** (not a half-built system).

### E. Risk Register

For each risk, provide:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|

Include at minimum:
1. Claude Max rate limits under heavy multi-agent usage
2. VPC cost management (compute, storage, bandwidth)
3. Security of Claude credentials on a remote server
4. Git worktree conflicts with concurrent agents
5. WebSocket connection stability for remote users
6. Data persistence and backup on a single VPC instance
7. Learning curve if switching languages/frameworks
8. Feature parity gap during migration (temporary loss of working features)
9. Single-point-of-failure with VPC hosting vs managed services
10. Slack API rate limits and webhook reliability under high task volume

---

## Output Format & Constraints

**Length:** Target 3,000-5,000 words. Be specific, not verbose.

**Structure your response as:**
1. Executive summary (1 paragraph, max 150 words)
2. Feature comparison matrix (Section A table)
3. Best-of-breed selections (Section B, all 15 categories)
4. Recommended tech stack summary (table comparing current vs proposed, with "why change" column)
5. Architecture diagram (Mermaid)
6. Architecture proposal narrative (Section C decisions)
7. Build plan (Section D phases)
8. Risk register (Section E table)
9. **Build vs. Migrate verdict** — final recommendation with top 3 reasons

**Do NOT:**
- Speculate about features not observed in the three tools' source code or documentation
- Recommend technologies solely because they are popular — justify with evidence from the analyzed tools
- Assume the current tech stack should be preserved — challenge every choice
- Provide generic advice ("use best practices") — be specific ("use PM2 with ecosystem.config.cjs as demonstrated by claude-ws")

---

## Sources Researched

- [Vibe Kanban -- GitHub](https://github.com/BloopAI/vibe-kanban)
- [Vibe Kanban -- Official Site](https://vibekanban.com/)
- [Claw-Kanban -- GitHub](https://github.com/GreenSheep01201/Claw-Kanban)
- [Claude Workspace (claude-ws) -- GitHub](https://github.com/Claude-Workspace/claude-ws)
- [Claude Code Remote Control -- Official Docs](https://code.claude.com/docs/en/remote-control)
- [Using Claude Code with Pro/Max Plan -- Help Center](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- [Claude Code on VPS -- Lexy EYN](https://medium.com/@lexy_eyn/why-and-how-to-run-claude-code-on-a-vps-657daf79e3ea)
- [CLIProxyAPI -- Claude Max as API](https://rogs.me/2026/02/use-your-claude-max-subscription-as-an-api-with-cliproxyapi/)
- [Claude Code Max via AI Gateway -- Vercel](https://vercel.com/changelog/claude-code-max-via-ai-gateway-available-now-for-claude-code)
- [Claude Code Headless Auth -- GitHub Issue #7100](https://github.com/anthropics/claude-code/issues/7100)
