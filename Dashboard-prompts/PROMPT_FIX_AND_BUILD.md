# Agent Mission Control — Fix & Multi-Agent Build Prompt

## Purpose

This is an autonomous `/goal`-style execution prompt. It directs a coordinated team of
specialist agents to:

1. Fix all known bugs and failing tests first
2. Complete the remaining build plan across Phases 1–5
3. Do this with zero inter-agent file conflicts using worktree isolation and file ownership

Run this with `/goal` in the project root: `/home/gregmorris/agent-mission-control/`

---

## Pre-Flight: Skills to Load

Before executing any task:

1. Load `~/.claude/skills/REGISTRY.md` — identify relevant skills per task type
2. For debugging tasks → invoke `debug` skill first
3. For new implementation tasks → invoke `tdd` skill first (tests before code)
4. For architecture decisions → invoke `architect` skill first
5. For each task completion → fire the chief-architect review gate

These are non-negotiable per the using-superpowers protocol.

---

## Known Bugs (Fix First — Single Agent, No Parallelism)

**Before any feature work begins, a single Bug Fix Agent must bring the codebase to a
green baseline.**

### Confirmed failures (as of 2026-03-17)

| Location | Error | Fix Required |
|----------|-------|-------------|
| `bridge/src/commands/resolveConflict.ts` | File does not exist | Implement the handler (test file already written — follow TDD: tests are red, make them green) |
| `bridge/src/commands/resolveConflict.test.ts:91` | `string[]` compared to `string` | Fixed by implementing the handler correctly |
| `bridge/src/commands/resolveConflict.test.ts:94` | `gitAddCall` possibly undefined | Fixed by implementing the handler correctly |

### Bug Fix Agent instructions

```
You are the Bug Fix Agent for Agent Mission Control.

Working directory: /home/gregmorris/agent-mission-control/

STEP 1 — Run the full test suite:
  cd bridge && npm test 2>&1

STEP 2 — Run type checks on both packages:
  cd bridge && npx tsc --noEmit
  cd app && npx tsc --noEmit

STEP 3 — For each failure:
  - Invoke the 'debug' skill BEFORE touching any code
  - Read the test file fully before writing the implementation
  - The test file IS the spec — make the tests pass, do not change the tests
  - Follow the TDD skill: Red → Green → Refactor

STEP 4 — For resolveConflict.ts specifically:
  - Read: bridge/src/commands/resolveConflict.test.ts (full file)
  - Read: bridge/src/commands/createPr.ts (use as structural reference)
  - Read: bridge/src/ownership/enforcer.ts (conflict detection is already wired here)
  - Read: bridge/src/commands/processor.ts (see how commands are dispatched)
  - Implement bridge/src/commands/resolveConflict.ts to satisfy all 8 failing tests
  - Architecture rule: use args array for all git/shell calls — NO string interpolation
  - Architecture rule: must integrate with the ownership enforcer and audit logger

STEP 5 — After implementation:
  cd bridge && npm test
  cd bridge && npx tsc --noEmit
  cd app && npx tsc --noEmit
  All must be green before proceeding.

STEP 6 — Fire the review gate on all touched files.

STEP 7 — Commit: 'fix: implement resolveConflict handler — fixes 8 failing tests'
```

**Gate:** Do not proceed to any Phase below until `npm test` exits 0 and both `tsc --noEmit`
commands exit 0.

---

## Build Plan Execution

The following phases run after the bug fix baseline is confirmed green.

Phases 1 and 2 are sequential (both touch `bridge/src/` — a single agent owns that layer).
Phases 3, 4, and 5 have independent sub-tasks that can run in parallel agents, each
isolated in its own git worktree with declared file ownership.

---

## Phase 1: Close the P1 Bridge Gaps
*Single Bridge Agent. Sequential. No parallelism.*

**Owning agent:** Bridge-Agent-P1
**Worktree:** `git worktree add ../amc-bridge-p1 -b feat/bridge-p1`
**Owns:** `bridge/src/worktree/`, `bridge/src/decompose/`

### Task 1.1 — M4-008: Worktree sync tests + branch aggregation

```
Skills to invoke: tdd (tests first), then chief-architect review gate after.

What exists:
  bridge/src/worktree/sync.ts — full implementation, zero tests
  docs/multi-vps-architecture.md — describes shared_remote and rsync modes

What's needed:
  1. Read sync.ts and multi-vps-architecture.md in full
  2. Write bridge/src/worktree/sync.test.ts covering:
     - syncSharedRemote: successful push, git failure, missing agentKey
     - syncRsync: SSH connection failure, missing host config
     - syncWorktree: mode 'none' is a no-op, mode 'shared_remote' calls syncSharedRemote,
       mode 'rsync' calls syncRsync
  3. Run tests — confirm green
  4. Implement branch aggregation: a new function aggregateBranches(agents) that
     iterates all agent keys and lists commits ahead of main — document in existing docs
  5. tsc --noEmit — must pass
  6. Review gate
```

### Task 1.2 — M6-001: Decompose parallel dispatch + DAG enforcement

```
Skills to invoke: tdd, architect (DAG enforcement pattern), review gate after.

What exists:
  bridge/src/decompose/decompose.ts — Claude API call, sequential
  bridge/src/decompose/handler.ts — orchestration, calls assignTask() per subtask
  bridge/src/decompose/types.ts — SubTask type has 'dependencies: string[]' field
  app/src/components/dag/DagView.tsx — already complete, expects dependency edges

What's needed:
  1. Read handler.ts and types.ts fully
  2. The SubTask.dependencies[] field exists but is unused during assignment — fix this:
     a. Build a dependency map from the subtask list
     b. Topological-sort subtasks (Kahn's algorithm — already implemented in DagView, use
        same logic in bridge)
     c. Spawn subtasks in parallel batches: tasks with no unmet deps spawn together;
        tasks that depend on incomplete tasks wait
     d. Use Promise.allSettled() for each parallel batch — never Promise.all()
  3. Write tests for the new parallel dispatch in handler.test.ts
  4. Update decompose.ts to request dependency hints from Claude in the prompt
  5. tsc --noEmit — must pass
  6. Review gate
  7. Commit: 'feat(decompose): parallel batch dispatch + DAG enforcement'
```

**Phase 1 exit gate:** `cd bridge && npm test` green. `npx tsc --noEmit` clean.

---

## Phase 2: Bridge Integrity
*Single Bridge Agent (same agent continues). Sequential.*

**Owning agent:** Bridge-Agent-P2 (same worktree as P1 after merge, or new branch)
**Owns:** `bridge/src/commands/`, `bridge/src/worktree/`, `bridge/src/` (conflict scanner)

### Task 2.1 — M7-004: Conflict detection bridge handler

```
Skills to invoke: tdd, review gate after.

Context: The resolveConflict.test.ts (now passing from bug fix) defines the exact interface.
UI component already exists at app/src/components/git/ConflictPanel.tsx.

What's needed:
  1. Implement bridge/src/commands/resolveConflict.ts — already specced by the test file
  2. Add conflict SCANNER to bridge main loop:
     a. New module: bridge/src/worktree/conflictScanner.ts
     b. Function: scanForConflicts(worktreePath): Promise<string[]>
        - Runs 'git diff --name-only --diff-filter=U' in the worktree
        - Returns array of conflicting file paths
        - Empty array = no conflicts
     c. Called in main loop after health check, updates session.conflictFiles[]
     d. Write tests for scanForConflicts
  3. Wire into processor.ts: 'resolve_conflict' command type → resolveConflict handler
  4. tsc --noEmit — clean
  5. Review gate
  6. Commit: 'feat(git): conflict scanner + resolve_conflict command handler'
```

### Task 2.2 — M6-004: Parallel exploration mode (XL)

```
Skills to invoke: architect FIRST (design before implementation), tdd, review gate after.

This is the most complex remaining item. Read the architecture rules before starting.
Key constraint from architecture.md: Bridge is the ONLY process that spawns agents.

Design requirements:
  - New command type: 'explore_parallel'
  - Payload: { objective: string, approaches: string[], worktreeBase: string }
  - For each approach: create an isolated git worktree (branch: explore/<timestamp>/<n>)
  - Spawn one agent per worktree with the approach as its prompt context
  - Monitor all agents via the existing health checker
  - Competition ends when: first agent completes OR timeout (configurable, default 30min)
  - Voting/selection: present results to the dashboard via approval queue
    (architecture rule: approval gates enforced at bridge, not UI)
  - Winning worktree: merge to current branch
  - Losing worktrees: cleanup via worktree manager

New modules to create:
  bridge/src/commands/exploreParallel.ts — command handler
  bridge/src/explore/competition.ts — competition lifecycle manager
  bridge/src/explore/selector.ts — approach selection (timeout + first-complete logic)
  bridge/src/explore/types.ts — ExploreSession, Approach, CompetitionResult types

Integration points:
  - worktree/manager.ts — worktree creation/cleanup (already exists)
  - commands/spawn.ts — agent spawning (already exists)
  - health/checker.ts — monitor competing agents (already exists)
  - supabase/sync.ts — push competition state to dashboard (already exists)
  - approval queue — surface winner selection to human operator

Write tests for competition.ts and selector.ts before implementing.
Review gate must pass before commit.
Commit: 'feat(explore): parallel exploration mode with competition lifecycle'
```

**Phase 2 exit gate:** `npm test` green. `npx tsc --noEmit` clean. Both commits merged to main.

---

## Phase 3: Enterprise Foundation
*Two agents in parallel. Different layers — no shared files.*

### Agent A: Supabase-Agent (owns schema + RLS)
**Worktree:** `git worktree add ../amc-supabase-p3 -b feat/workspace-schema`
**Owns:** `supabase/migrations/`, `app/src/hooks/useWorkspaces.ts`, `app/src/hooks/useAdminConfig.ts`
**Must NOT touch:** `bridge/src/`, `app/src/components/` (those are Agent B)

#### Task 3.1 — M8-001: Team workspaces schema + RLS

```
Skills to invoke: architect (schema design), tdd, review gate after.

What exists:
  app/src/components/workspace/WorkspaceSwitcher.tsx — UI queries useWorkspaces()
  app/src/hooks/useWorkspaces.ts — queries Supabase 'workspaces' table (doesn't exist yet)
  app/src/stores/sessionStore.ts — has workspaceId field

What's needed:
  1. Create Supabase migration: supabase/migrations/<timestamp>_workspaces.sql
     Schema:
       workspaces (id uuid PK, name text, owner_id uuid FK profiles, created_at timestamptz)
       workspace_members (workspace_id uuid FK, user_id uuid FK profiles, role text CHECK('owner','member'))
     RLS:
       workspaces: SELECT for members, INSERT/UPDATE/DELETE for owner only
       workspace_members: SELECT for self, INSERT/DELETE for workspace owner
  2. Update app/src/hooks/useWorkspaces.ts — fix queries to match schema
  3. Update all Supabase queries that return agent_sessions, agents, events, kanban_tasks
     to filter by workspaceId (join through workspace_members)
  4. Test: app/src/hooks/useWorkspaces.test.ts — mock Supabase client
  5. tsc --noEmit on app/ — clean
  6. Review gate — specifically check RLS for no 'allow all' policies
  7. Commit: 'feat(workspaces): schema, RLS, and workspace-scoped queries'
```

#### Task 3.2 — M8-004: Admin controls schema + bridge enforcement

```
Depends on Task 3.1 (workspace schema must exist first).

What exists:
  app/src/components/admin/AdminPanel.tsx — UI complete
  app/src/hooks/useAdminConfig.ts — queries 'admin_config' table (doesn't exist yet)

What's needed:
  1. Create Supabase migration: supabase/migrations/<timestamp>_admin_config.sql
     Schema:
       admin_config (workspace_id uuid PK FK workspaces, session_budget_usd numeric,
                     agent_budget_usd numeric, allowed_models text[], updated_at timestamptz)
     RLS: SELECT/UPDATE for workspace owner only
  2. Fix useAdminConfig.ts queries to match schema
  3. Add bridge enforcement:
     New module: bridge/src/config/adminPolicy.ts
       - loadAdminPolicy(workspaceId): fetch admin_config from Supabase
       - enforceModelPolicy(model, policy): throws if model not in allowed_models
       - checkBudgetPolicy(currentCost, policy): throws if session cost exceeds cap
     Wire into spawn.ts: call enforceModelPolicy before spawning
     Wire into health checker: call checkBudgetPolicy on each cycle; pause agent if exceeded
  4. Write tests for adminPolicy.ts
  5. Review gate — specifically check bridge enforcement is not UI-only
  6. Commit: 'feat(admin): admin_config schema, RLS, and bridge-side policy enforcement'
```

---

### Agent B: App-Features-Agent (owns app/src/ components only)
**Worktree:** `git worktree add ../amc-app-p3 -b feat/app-admin-wiring`
**Owns:** `app/src/components/admin/`, `app/src/components/workspace/`
**Must NOT touch:** `supabase/`, `bridge/src/`

#### Task 3.3 — Wire admin + workspace components to real data

```
Depends on Agent A completing Task 3.1 + 3.2 (schema must be merged to main first).
This agent merges main, then wires the UI to the live hooks.

What's needed:
  1. Merge latest main (includes Agent A's schema work)
  2. Test AdminPanel.tsx end-to-end with the live useAdminConfig hook
  3. Test WorkspaceSwitcher.tsx end-to-end with the live useWorkspaces hook
  4. Add integration tests: app/src/components/admin/AdminPanel.test.tsx
  5. tsc --noEmit — clean
  6. Review gate
  7. Commit: 'test(admin): integration tests for AdminPanel and WorkspaceSwitcher'
```

**Phase 3 exit gate:** Both agents' branches merged to main. `npm test` green on both app/ and bridge/.

---

## Phase 4: API & Integrations
*Three agents in parallel. Each owns a completely separate layer.*

### Agent A: API-Agent
**Worktree:** `git worktree add ../amc-api-p4 -b feat/api-complete`
**Owns:** `app/api/`, `app/src/lib/api-docs/` (new)
**Must NOT touch:** `bridge/src/`, `.github/`, `docker-compose*.yml`

#### Task 4.1 — M8-006: Complete CI/CD API

```
Skills: tdd, review gate after.

What exists:
  app/api/sessions.ts — POST /sessions
  app/api/sessions/[id].ts — GET /sessions/:id
  app/api/sessions/[id]/tasks.ts — GET+PATCH /sessions/:id/tasks
  app/api/_auth.ts — token validation
  app/api/_commands.ts — IPC command serialization

What's needed:
  1. Add missing endpoints:
     DELETE /sessions/:id — terminate session (write 'terminate' command to bridge)
     PATCH /sessions/:id — update session metadata (title, priority)
     GET /sessions — list all sessions with pagination (?limit=20&offset=0)
  2. Add rate limiting: in-memory token bucket, 60 req/min per API key
  3. Consistent error responses: { error: string, code: string } with correct HTTP status
  4. Write OpenAPI spec: app/api/openapi.yaml (YAML, covers all endpoints)
  5. Write tests: app/api/sessions.test.ts covering CRUD + rate limit + auth failure
  6. tsc --noEmit — clean
  7. Review gate — check no SQL injection vectors, auth on every route
  8. Commit: 'feat(api): complete CRUD, pagination, rate limiting, OpenAPI spec'
```

---

### Agent B: GHActions-Agent
**Worktree:** `git worktree add ../amc-ghactions-p4 -b feat/gh-actions-webhook`
**Owns:** `.github/workflows/`
**Must NOT touch:** `app/`, `bridge/src/`, `docker-compose*.yml`

#### Task 4.2 — M8-007: GitHub Actions reverse webhook + PR status check

```
Skills: review gate after.

Depends on M8-006 being merged to main (API endpoint must exist).
Merge main first before starting this task.

What exists:
  .github/workflows/agent-on-pr.yml — spawns agent, posts comment with session link

What's needed:
  1. Add reverse webhook step to agent-on-pr.yml:
     - Poll /api/sessions/:id every 2 minutes (max 60 polls = 2 hours)
     - When session status = 'done': fetch session events from API
     - Post a summary comment to the PR with: findings, files changed, cost
     - Use GitHub Script action for PR comment formatting
  2. Register a pending GitHub status check at PR open time (context: 'agent-mc/review')
  3. Set status to 'success' or 'failure' based on session outcome
     - success: agent completed, no critical errors
     - failure: agent errored or budget exceeded
  4. Timeout handling: if session doesn't complete in 2 hours, post timeout comment
     and set status to 'neutral' (does not block merge)
  5. Ensure AGENT_MC_API_SECRET is documented in the workflow's env vars section
  6. Review gate
  7. Commit: 'feat(ci): reverse webhook — post agent findings back to PR'
```

---

### Agent C: Infra-Agent
**Worktree:** `git worktree add ../amc-infra-p4 -b feat/docker-selfhost`
**Owns:** `docker-compose.yml`, `docker-compose.selfhost.yml`, `docker-compose.override.yml.example`, `infra/`
**Must NOT touch:** `app/`, `bridge/src/`, `.github/`

#### Task 4.3 — M9-006: Docker self-hosted — complete stack

```
Skills: review gate after.

What exists:
  docker-compose.selfhost.yml — dashboard (nginx), supabase-db, supabase-kong, supabase-studio
  docker-compose.override.yml.example — override template

What's needed:
  1. Add bridge service to docker-compose.selfhost.yml:
     bridge:
       build: ./bridge
       volumes:
         - ./bridge/state:/app/state
         - ./bridge/commands:/app/commands
         - ./bridge/logs:/app/logs
       environment: (reads from .env)
       depends_on: [supabase-db]
       restart: unless-stopped
  2. Add mcp-server service:
     mcp-server:
       build: ./mcp-server
       environment: (reads from .env)
       depends_on: [bridge]
       restart: unless-stopped
  3. Add init container that runs Supabase migrations on first boot
  4. Create .env.selfhost.example with all required variables and descriptions
  5. Write infra/setup.sh — interactive script that:
     - Copies .env.selfhost.example to .env
     - Prompts for required values (Supabase password, Anthropic key)
     - Runs docker-compose -f docker-compose.selfhost.yml up -d
     - Waits for health checks to pass
     - Prints dashboard URL
  6. Review gate — check no hardcoded localhost, no service_role key in client code
  7. Commit: 'feat(infra): complete self-hosted Docker Compose stack with bridge + MCP'
```

**Phase 4 exit gate:** All three branches merged to main. `npm test` green.

---

## Phase 5: Ecosystem & Launch Readiness
*Can be parallelised — all items own distinct files. Run after Phase 4 is fully merged.*

### Agent assignments:

| Agent | Task | Worktree branch | Owns |
|-------|------|-----------------|------|
| Docs-Agent | M9-003: Fill documentation site content | feat/docs-content | `docs/site/docs/`, `docs/site/src/` |
| Templates-Agent | M9-002: Community role templates | feat/role-templates | `bridge/src/` (new role-templates dir only), `docs/site/docs/templates/` |
| Release-Agent | M9-005: Homebrew CI release job | feat/homebrew-release | `Formula/`, `.github/workflows/release.yml` (new file only) |
| SSO-Agent | M8-002: SSO integration | feat/sso | `app/src/components/auth/`, `supabase/` (new migrations only) |
| i18n-Agent | TD-008: i18n component integration | feat/i18n | `app/src/` (read-only on components, add useTranslation calls only), `app/src/i18n/locales/` |

### Task 5.1 — M9-003: Documentation site

```
Skills: review gate after.

The Docusaurus scaffold exists. Write the missing content:
  docs/site/docs/getting-started.md — full install guide (VPS, Docker, Homebrew)
  docs/site/docs/architecture.md — expand from .claude/rules/architecture.md
  docs/site/docs/bridge/ — config.json reference, command types, audit log format
  docs/site/docs/dashboard/ — env vars, screen profiles, keyboard shortcuts
  docs/site/docs/api/ — expand openapi.yaml from Phase 4 into human-readable docs
  docs/site/docs/tutorials/ — "First agent session", "Set up multi-VPS", "Using the API"

Add GitHub Actions deploy workflow:
  .github/workflows/docs.yml — build Docusaurus and deploy to Vercel on push to main

Commit: 'docs: complete documentation site content and deploy workflow'
```

### Task 5.2 — M9-002: Community agent role templates

```
What's needed:
  New directory: bridge/src/role-templates/
  Files: frontend-dev.json, devops-engineer.json, qa-specialist.json,
         data-analyst.json, security-reviewer.json
  Schema per template:
    { name, version, description, allowedTools[], directoryScope[], systemPrompt, maxTurns }
  Integration: bridge/src/commands/spawn.ts — if role template specified, merge its
    allowedTools and directoryScope into the spawn config
  Docs: docs/site/docs/templates/ — one page per template with example usage
  Tests: bridge/src/role-templates/templates.test.ts — validate schema of each template

Commit: 'feat(templates): 5 community agent role templates with bridge integration'
```

### Task 5.3 — M9-005: Homebrew CI release job

```
What's needed:
  .github/workflows/release.yml:
    trigger: push to tag matching v*.*.*
    steps:
      - Build bridge and mcp-server: npm ci && npm run build
      - Create tarball: tar -czf agent-mc-$VERSION.tar.gz dist/ package.json
      - Compute sha256 and store as output
      - Create GitHub Release with the tarball as asset
      - Update Formula/agent-mc.rb url and sha256 with the new release values (sed)
      - Commit the updated formula to the homebrew tap repo (if exists)
  Update Formula/agent-mc.rb:
    - Replace PLACEHOLDER_SHA256 with a sed-token that the release workflow fills in
    - Add proper homepage and license fields

Commit: 'chore(release): Homebrew formula CI release workflow'
```

### Task 5.4 — M8-002: SSO integration

```
Skills: architect (SSO flows), security-reviewer, review gate after.

What's needed:
  1. Enable SAML in Supabase: new migration enabling auth.providers config
  2. Update app/src/components/auth/LoginPage.tsx to show SSO option
  3. Add app/src/components/auth/SsoCallback.tsx — handles SAML assertion redirect
  4. Document required Supabase dashboard config in docs/site/docs/enterprise/sso.md
  5. Security review: verify no SAML token logged, no open redirect
  6. Review gate

Commit: 'feat(auth): SAML/OIDC SSO integration via Supabase'
```

### Task 5.5 — TD-008: i18n component integration

```
What's needed:
  1. Read app/src/i18n/locales/en.json — understand existing key structure
  2. For each component in app/src/components/: replace hardcoded strings with t('key')
     Priority order: topbar, agents, kanban, cost, auth, then the rest
  3. Add missing keys to en.json as you go
  4. Add es.json (Spanish) and fr.json (French) translations for all keys (use AI translate)
  5. Ensure date/number formatting uses i18next's format functions
  6. Tests: verify useTranslation is called in key components

Commit: 'feat(i18n): integrate useTranslation across all components, add es + fr locales'
```

**Phase 5 exit gate:** All branches merged. Docs site builds: `cd docs/site && npm run build`.
`npm test` green in app/ and bridge/.

---

## Conflict Prevention Protocol

These rules apply to ALL agents at ALL times:

### 1. Worktree Isolation (non-negotiable)

Every agent runs in its own git worktree:
```bash
git worktree add ../amc-<agent-name> -b <branch-name>
```
No two agents share a worktree. No agent works directly on `main`.

### 2. File Ownership Declaration

Before a task begins, the agent must print its ownership declaration:

```
OWNERSHIP DECLARATION
Agent: <name>
Branch: <branch>
Owns (read+write): <list of dirs/files>
Reads only: <list>
Will NOT touch: <list>
```

If a task requires touching a file owned by another agent, STOP and raise a conflict flag
rather than proceeding.

### 3. Merge Order Within a Phase

Within each phase, agents merge in dependency order:
- Phase 3: Supabase-Agent merges first → App-Agent merges second (needs schema)
- Phase 4: API-Agent merges first → GHActions-Agent merges second (needs API endpoint)
- Phase 5: All agents are independent — merge order is alphabetical

### 4. The Bridge Is a Single-Writer Layer

`bridge/src/` is NEVER touched by more than one agent at a time across all phases.
Phase 1 → Phase 2 → Phase 3 (Admin Policy) → Phase 5 (Templates) are all sequential
on the bridge layer.

### 5. Supabase Migrations Are Sequential

Migrations are numbered. Two agents must not create migrations with the same timestamp.
Convention: `<unix_timestamp>_<description>.sql`
Phases that create migrations (3, 4, 5) must run their migration tasks in series.

### 6. Review Gate Before Every Merge

No branch merges to main without a passing chief-architect review gate:
```bash
cd <worktree> && npx tsc --noEmit && npm test
```
Both must be green. Review gate must be explicitly declared passed in the agent's output.

---

## Acceptance Criteria (All Phases)

- [ ] `cd bridge && npm test` — 0 failures
- [ ] `cd bridge && npx tsc --noEmit` — 0 errors
- [ ] `cd app && npx tsc --noEmit` — 0 errors
- [ ] `cd app && npm test` — 0 failures
- [ ] `cd docs/site && npm run build` — 0 errors
- [ ] `docker-compose -f docker-compose.selfhost.yml config` — valid compose file
- [ ] `cat Formula/agent-mc.rb` — no PLACEHOLDER_SHA256 values
- [ ] All 14 backlog items updated to ✅ Done in BACKLOG.md
- [ ] Final commit: `docs: close all remaining backlog items — all phases complete`
