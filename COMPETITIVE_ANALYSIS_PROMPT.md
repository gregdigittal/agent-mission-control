# Competitive Analysis & Refactoring Prompt: Agent Mission Control v2

## Context

You are reviewing three third-party AI agent orchestration tools to inform the **complete redesign** of **Agent Mission Control** (AMC) — currently a Next.js + Supabase + Vercel dashboard for monitoring Claude Code agent teams. The goal is to produce a detailed architectural plan that incorporates the best features from each tool, deploys on a VPC with remote browser access, and runs entirely on a Claude Max subscription (no API keys).

**IMPORTANT — Architecture is NOT sacred.** The current Next.js + Supabase + Vercel stack is the starting point, not a constraint. If the analysis shows that a different language (Rust, Go), a different database (SQLite, embedded Postgres), a different framework (Vite, SvelteKit), or a completely different architecture would better serve the goals, **recommend it.** The only things that must be preserved are:
- The **concept** (a dashboard for monitoring and orchestrating Claude Code agent teams)
- The **MCP server integration** (agents self-report via MCP tools)
- The **design language** (dark theme, Geist fonts, cyan/green/amber accents, scanline overlay)
- The **deployment target** (VPC with remote browser access, Claude Max subscription)
- **Slack integration** (users must be able to action tasks directly from Slack — see details below)

Everything else — framework, language, database, hosting, state management, build system — is open to change.

### Slack Integration Requirement
Users must be able to **action Kanban tasks directly from Slack** without opening the dashboard. This includes:
- **Task notifications:** When agents complete tasks, request approval, encounter errors, or need input — send structured Slack messages to a configured channel
- **Actionable messages:** Slack messages should include interactive buttons/menus for: approving/rejecting agent recommendations, moving tasks between Kanban columns, assigning tasks to agents, restarting failed tasks
- **Slash commands or bot:** A `/amc` slash command or Slack bot that can: list active sessions and their status, show task summaries, trigger agent actions (start, stop, reassign)
- **Bidirectional sync:** Task state changes in Slack must reflect in the dashboard in real-time, and vice versa
- **Thread-based context:** Each task should map to a Slack thread so discussion, approvals, and agent output stay organized

Note: Claw-Kanban already supports chat-to-card integration via webhooks (Telegram, Slack) — evaluate their approach and whether it can be adopted or improved upon for AMC v2.

---

## Your Current App: Agent Mission Control (Reference Only)

**Current Stack:** Next.js 16, React 19, TypeScript, Zustand 5, Tailwind v4, Supabase (Postgres + Realtime + Edge Functions), Vercel hosting

**Current architecture (what exists today — may be entirely replaced):**
- Single-page dashboard with tiling window manager (1-4 panes)
- Session management with stale detection (5min timeout) and auto-promotion on realtime updates
- Agent View: progress ring, pipeline stage pills, agent cards with status/metrics, scrolling activity feed with filters
- Kanban Board: 4 columns (Backlog -> In Progress -> Review -> Done), HTML5 drag-and-drop, approval/recommendation badges
- MCP Server (stdio transport, 7 tools): `amc_report_session`, `amc_create_tasks`, `amc_update_task`, `amc_assign_task`, `amc_request_approval`, `amc_report_metrics`, `amc_push_event`
- Supabase Edge Function (`ingest-state`) handles POST upserts from MCP server
- Global `~/.claude/CLAUDE.md` instructs all Claude Code sessions to self-report
- Design: dark theme with Geist Mono/Sans fonts, cyan/green/amber/red accents, scanline overlay

**Current limitations (problems to solve):**
- Passive monitoring only — cannot dispatch tasks TO agents, only receive reports FROM them
- No workspace isolation (no git worktrees)
- No embedded terminal or browser preview
- No multi-agent orchestration (no role-based routing)
- Hosted on Vercel (serverless) — not suitable for long-running agent processes
- No direct Claude Code process management
- No code review or diff viewing capabilities
- No checkpoint/rollback system for agent work
- No plugin/extension system for custom agent behaviors
- No Slack or messaging integration — all interaction requires opening the dashboard

---

## Tools to Analyze

### Tool 1: Vibe Kanban
- **Repo:** https://github.com/BloopAI/vibe-kanban
- **Site:** https://vibekanban.com
- **Stack:** Rust (49%) + TypeScript (47%), PostgreSQL, React, Vite
- **22.9k GitHub stars, 30k+ active users, 100k+ PRs created**

**Key features to evaluate:**
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

**Architecture note:** Rust backend is a deliberate choice for performance-critical operations (git worktree management, file watching, process orchestration). Evaluate whether AMC v2 would benefit from a compiled backend language.

### Tool 2: Claw-Kanban
- **Repo:** https://github.com/GreenSheep01201/Claw-Kanban
- **Stack:** Node.js 22+, React 19, Vite, SQLite (node:sqlite), TypeScript
- **Glassmorphism UI design**

**Key features to evaluate:**
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

**Architecture note:** Uses Node.js built-in SQLite (`node:sqlite`) for zero-dependency local persistence. This avoids the need for an external database service entirely. Evaluate whether AMC v2 should adopt a similar local-first data model.

### Tool 3: Claude Workspace (claude-ws)
- **Repo:** https://github.com/Claude-Workspace/claude-ws
- **Stack:** Next.js 16, React 19, SQLite + Drizzle ORM, Socket.io, Tailwind CSS 4, Radix UI, Zustand
- **95.9% TypeScript, v0.3.100 (March 2026), 454 commits, 211 stars, MIT license**
- **Process management:** PM2 via `ecosystem.config.cjs`
- **Default port:** 8556
- **Install:** `npx -y claude-ws`, `npm install -g claude-ws`, or from source with pnpm

**Key features to evaluate:**
1. Real-time streaming via Socket.io (live Claude responses with token-by-token output)
2. Checkpoint system — save and rewind to any conversation state
3. Tabbed CodeMirror editor with syntax highlighting and AI suggestions
4. Full Git integration (status, stage, commit, diff, visual graph)
5. Agent Factory — plugin system for custom skills, commands, agents
6. Secure remote access via Cloudflare Tunnel with API auth key (`API_ACCESS_KEY` env var)
7. Multiple themes (Light, Dark, VS Code variants, Dracula)
8. Local-first SQLite + Drizzle ORM architecture (no external database needed)
9. PM2 process manager for production deployments with auto-restart
10. Drag-and-drop Kanban with full conversation history per card

**Architecture note:** This tool shares the closest tech stack to AMC's current one (Next.js, React 19, Zustand, Tailwind v4). However, it replaces Supabase with local SQLite + Drizzle ORM and adds Socket.io for real-time. Its PM2-based process management and Cloudflare Tunnel remote access are directly relevant to the VPC deployment target.

**Environment variables of interest:**
- `PORT` — server port (default 8556)
- `API_ACCESS_KEY` — authentication for remote access
- `LOG_LEVEL` — logging verbosity
- `CLAUDE_PATH` — path to Claude Code binary
- `ANTHROPIC_API_RETRY_TIMES` — retry configuration

---

## Deployment Constraints: VPC + Remote Browser + Claude Max

### VPC Deployment Requirements
The refactored app must run on a Virtual Private Cloud (VPC) instance — not serverless. This means:
- A persistent Linux server (e.g., AWS EC2, GCP Compute Engine, Hetzner, DigitalOcean)
- Long-running processes for agent orchestration
- Docker containerization for reproducible deploys
- Reverse proxy (Caddy or Nginx) for HTTPS termination
- Persistent storage (SQLite or Postgres) on the instance

### Remote Browser Access
Users must be able to access the dashboard from any device via browser:
- Cloudflare Tunnel or SSH tunneling for secure exposure without opening ports
- Authentication layer (API key, OAuth, or basic auth) to protect the dashboard
- Mobile-responsive UI for monitoring from phone/tablet
- Claude Code's Remote Control feature (claude.ai/code) for continuing sessions from any device

### Claude Max Subscription (No API Keys)
The app must work with a $100/month Claude Max subscription, NOT API billing:
- Claude Code CLI (`claude`) is the execution interface, not the API
- Use `claude --dangerously-skip-permissions` or `--allowedTools` for headless automation
- Authentication via `claude /login` + credential file transfer to the VPC
- No `ANTHROPIC_API_KEY` — all agent interaction flows through the Claude Code CLI
- Third-party proxy tools (like CLIProxyAPI) may be evaluated but are NOT required
- The MCP server should communicate with Claude Code instances via stdio, not HTTP API calls

---

## Analysis Tasks

For each of the three tools, provide:

### A. Feature Comparison Matrix
Create a detailed table comparing features across all three tools AND Agent Mission Control's current state (4 tools total = 5 columns including AMC). Categories:
- Task Management (Kanban columns, drag-drop, sub-issues, priorities)
- Agent Orchestration (multi-agent, role routing, auto-assignment, parallel execution)
- Workspace Isolation (git worktrees, branch management, safety)
- Real-time Monitoring (terminal output, activity feeds, streaming)
- Code Review (diff view, inline comments, PR generation)
- Built-in Tooling (browser preview, code editor, DevTools)
- Deployment Model (local, Docker, cloud, VPC suitability)
- Security (auth, encryption, token management)
- MCP Integration (server support, tool exposure)
- Claude Max Compatibility (CLI-based, no API key requirement)
- Plugin/Extension System (custom agents, skills, commands)
- Data Architecture (database, persistence, backup)
- Process Management (spawning, monitoring, terminating agents)
- Remote Access (tunneling, auth, mobile support)
- Chat/Messaging Integration (Slack, Telegram, webhooks, actionable messages)

### B. Best-of-Breed Feature Selection
For each feature category above, identify:
1. Which tool does it best and why
2. Whether AMC v2 should adopt it, adapt it, or skip it
3. Implementation complexity (Low/Medium/High)
4. Priority for the refactoring (P0 Critical / P1 High / P2 Medium / P3 Nice-to-have)

### C. Architecture Proposal — Clean-Sheet Design
Design the target architecture for AMC v2. **Do not assume the current stack will be kept.** Propose the best architecture based on what the three tools demonstrate works well:

1. **Language & runtime:** Should AMC v2 use TypeScript/Node.js, Rust, Go, or a hybrid? Justify based on what each tool uses and why.
2. **Frontend framework:** Next.js, Vite + React, SvelteKit, or something else? Consider SSR needs (or lack thereof) for a dashboard app.
3. **Build system & bundler:** Webpack (Next.js default), Vite, Turbopack, esbuild? Consider developer experience and build speed.
4. **Database & ORM:** Supabase (managed Postgres), SQLite + Drizzle (local-first), SQLite via `node:sqlite` (zero-dep), PostgreSQL (self-hosted), or hybrid? Consider VPC deployment implications.
5. **Real-time layer:** Supabase Realtime (Postgres changes), Socket.io (WebSocket), raw WebSocket, Server-Sent Events, or hybrid?
6. **Process management:** PM2, systemd, Docker Compose, custom process manager, or Rust-based (like Vibe Kanban)?
7. **Agent process management:** How Claude Code instances are spawned, monitored, and terminated on the VPC.
8. **Workspace isolation:** Git worktree strategy for parallel agent execution.
9. **MCP server evolution:** How the current 7-tool MCP server grows to support bidirectional orchestration.
10. **Authentication:** How Claude Max credentials flow from user -> VPC -> Claude Code processes.
11. **Remote access:** Cloudflare Tunnel + auth middleware design.
12. **Mobile experience:** Responsive design considerations for phone/tablet monitoring.
13. **Plugin system:** How to support custom agent behaviors, skills, and commands (Agent Factory concept from claude-ws).
14. **Slack integration:** Architecture for bidirectional Slack integration — incoming webhooks for notifications, Slack Block Kit for actionable messages, slash commands or bot for task management, thread-based context per task. How does this integrate with the real-time layer and Kanban state?

### D. Migration / Build Plan
Produce a phased plan. This may be a **migration** from the current codebase OR a **greenfield build** if the architecture analysis warrants it. Be explicit about which approach you recommend and why.

**If migrating from current codebase:**
- Phase 1: VPC deployment + Docker containerization (keep current features, new hosting)
- Phase 2: Database migration (Supabase -> local, if recommended)
- Phase 3: Agent process management + workspace isolation
- Phase 4: Real-time terminal streaming + enhanced Kanban
- Phase 5: Built-in browser preview + code review
- Phase 6: Multi-agent orchestration + role routing

**If building greenfield:**
- Phase 1: Core infrastructure (framework, database, auth, Docker, VPC)
- Phase 2: Dashboard UI (Agent View, Kanban Board, tiling manager)
- Phase 3: MCP server + agent process management
- Phase 4: Workspace isolation + real-time streaming
- Phase 5: Code review + browser preview
- Phase 6: Plugin system + multi-agent orchestration

For each phase, specify:
- Files to create/modify (or new project structure if greenfield)
- New dependencies to add
- Database schema / migrations needed
- Estimated complexity (days/weeks)
- What can be reused from the current codebase (if anything)
- What can be borrowed/adapted from the three analyzed tools

### E. Risk Assessment
Identify and mitigate risks:
1. Claude Max rate limits under heavy multi-agent usage
2. VPC cost management (compute, storage, bandwidth)
3. Security of Claude credentials on a remote server
4. Git worktree conflicts with concurrent agents
5. WebSocket connection stability for remote users
6. Data persistence and backup strategy
7. Transitioning from Vercel serverless to VPC long-running processes
8. Learning curve if switching languages/frameworks (e.g., Rust backend)
9. Feature parity gap during migration (temporary loss of working features)
10. Single-point-of-failure risk with VPC hosting vs. managed services

---

## Output Format

Structure your response as a comprehensive technical document with:
1. Executive summary (1 paragraph)
2. Feature comparison matrix (table with 5 columns: AMC Current, Vibe Kanban, Claw-Kanban, Claude Workspace)
3. Best-of-breed selections with justification
4. **Recommended tech stack** (with explicit comparison to current stack, highlighting what changes and why)
5. Target architecture diagram (ASCII or Mermaid)
6. Detailed build/migration plan with file-level specifics
7. Risk register with mitigations
8. Estimated timeline (in weeks) per phase
9. **Build vs. Migrate recommendation** with clear reasoning

Ground all recommendations in the actual features observed in the three tools. Do not speculate about features that weren't found during research. Cite specific capabilities by tool name.

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
