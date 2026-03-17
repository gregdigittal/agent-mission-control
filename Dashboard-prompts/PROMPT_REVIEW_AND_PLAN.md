# Agent Mission Control — Codebase Review & Build Plan Prompt

## Purpose

This prompt is for a thorough review agent. Its job is to:

1. Audit the actual state of the codebase against `BACKLOG.md`
2. Identify what is fully implemented, partially implemented, stub-only, or genuinely missing
3. Produce a corrected backlog status
4. Propose a logical, sequenced build plan for everything that remains

---

## Context

**Project:** Agent Mission Control — real-time dashboard for orchestrating teams of Claude Code agents across git worktrees and VPS nodes.

**Working directory:** `/home/gregmorris/agent-mission-control/`

**Key directories:**
- `dashboard/` — MVP single-file HTML/JS/CSS dashboard (Milestone 1)
- `bridge/` — Node.js/TypeScript orchestration daemon (Milestone 2)
- `bridge-remote/` — Lightweight bridge for remote VPS nodes (Milestone 4)
- `app/` — React/Vite/Tailwind/Supabase OSS dashboard (Milestone 3+)
- `mcp-server/` — MCP server for agent ↔ dashboard comms (Milestone 5)
- `docs/` — Documentation site (Docusaurus scaffold present)
- `Formula/` — Homebrew formula stub
- `infra/` — Infrastructure config (nginx, Caddyfile, docker-compose files)
- `.github/workflows/` — CI/CD pipeline

**Authoritative rules (read before reviewing):**
- `CLAUDE.md` — project overview, stack, env vars, quick commands
- `.claude/rules/architecture.md` — layer invariants and technology constraints
- `.claude/rules/project-conventions.md` — per-layer coding standards
- `.claude/rules/review-gate-extensions.md` — security and integrity checks

---

## Step 1: Read the Current Backlog

Read `BACKLOG.md` in full. Note every item marked 🔲 (not done) and every item with a caveat comment (e.g. "documented; impl deferred", "TBD", "deferred to polish").

---

## Step 2: Audit the Codebase

For each 🔲 backlog item, determine the true implementation state by reading the relevant source files. Classify each as:

- **DONE** — fully implemented, wired up, and integrated end-to-end
- **STUB** — file exists with meaningful structure but is incomplete (placeholder logic, TODOs, missing wiring)
- **PARTIAL** — some implementation exists but a significant chunk is missing
- **MISSING** — no relevant file exists at all

Use the following audit targets as your starting points:

| Backlog ID | Audit Target |
|------------|-------------|
| M4-008 | `docs/multi-vps-architecture.md`, `bridge/src/worktree/`, `bridge-remote/src/` |
| M6-001 | `bridge/src/decompose/decompose.ts`, `bridge/src/decompose/handler.ts`, `bridge/src/decompose/types.ts`, MCP tool integration |
| M6-002 | `app/src/components/dag/DagView.tsx`, routing/navigation wiring in `App.tsx` |
| M6-003 | `bridge/src/assign/assigner.ts`, integration with spawn flow |
| M6-004 | `bridge/src/` — look for parallel/competing mode logic |
| M6-006 | `app/src/components/replay/SessionReplay.tsx`, cost annotation integration |
| M7-004 | `app/src/components/git/ConflictPanel.tsx`, bridge-side conflict detection |
| M7-006 | `app/src/components/git/CreatePrModal.tsx`, bridge-side PR assembly logic |
| M8-001 | `app/src/components/workspace/WorkspaceSwitcher.tsx`, Supabase schema for workspaces |
| M8-002 | `app/src/components/auth/`, Supabase SAML/OIDC config |
| M8-004 | `app/src/components/admin/AdminPanel.tsx`, RLS policies for org controls |
| M8-006 | `infra/`, any REST API layer in bridge or app |
| M8-007 | `.github/workflows/`, any agent-on-PR hook |
| M9-001 | `bridge/src/` or `mcp-server/src/` — plugin/extension API |
| M9-002 | `bridge/src/` — agent role templates |
| M9-003 | `docs/site/` — Docusaurus config and content completeness |
| M9-005 | `Formula/agent-mc.rb` — Homebrew formula completeness |
| M9-006 | `docker-compose.yml`, `docker-compose.selfhost.yml` — self-hosted Supabase setup |
| TD-008 | `app/src/i18n/` — i18n framework and coverage |

For each item, read the relevant files and provide:
- Classification (DONE / STUB / PARTIAL / MISSING)
- What specifically is implemented
- What specifically is missing
- Estimated gap size (S/M/L)

---

## Step 3: Correct the Backlog

Produce a corrected status table that replaces `BACKLOG.md`'s summary. Format:

```
| ID | Title | True Status | Gap |
|----|-------|-------------|-----|
| M4-008 | Git worktree sync strategy | STUB | M |
| M6-001 | Task decomposition engine | PARTIAL | M |
...
```

---

## Step 4: Propose the Build Plan

Using the corrected statuses, produce a sequenced build plan. Apply the following sequencing rules:

**Dependency rules (from architecture):**
- Bridge completeness gates all advanced orchestration features (M6-003, M6-004 need M6-001)
- MCP server must be stable before agent-facing tools are extended (M9-001)
- Auth and workspace isolation (M8-001) must precede team features (M8-004) and SSO (M8-002)
- Documentation site (M9-003) should be written after the features it documents are stable
- Homebrew formula (N9-005) can only be cut after the CLI (`agent-mc`) and Docker path are tested
- CI/CD API (M8-006) gates GitHub Actions integration (M8-007)

**Prioritisation rules:**
- P0/P1 before P2/P3
- Items that unblock others before items that stand alone
- Polish and docs after features are functionally complete
- Avoid working on M9-006 (Docker self-host) until M8-001 team workspaces is done — self-hosting without auth isolation is a support liability

**Output format — one row per work item:**

```
## Phase N: <Theme>
Dependencies: <what must be done first>

| Seq | ID | Title | Gap | Rationale |
|-----|----|-------|-----|-----------|
| N.1 | M6-001 | ... | M | Unblocks M6-002, M6-003 |
| N.2 | M6-002 | ... | S | Depends on M6-001 DONE |
...
```

Group items into phases with clear themes (e.g. "Bridge Intelligence", "Enterprise Auth", "Ecosystem & Launch"). Each phase should be independently shippable.

---

## Step 5: Flag Architectural Risks

For any backlog item where the current stub/partial implementation deviates from the architecture rules in `.claude/rules/architecture.md` or `.claude/rules/review-gate-extensions.md`, flag it explicitly:

```
⚠️  RISK: [ID] [title]
Rule violated: <which invariant>
Current state: <what the stub does wrong>
Required fix before proceeding: <what must change>
```

---

## Step 6: Update BACKLOG.md

After producing the review and plan:

1. Update `BACKLOG.md` to reflect the corrected status for all audited items
2. Add the sequenced build plan as a new section at the bottom of `BACKLOG.md` under the heading `## Proposed Build Sequence`
3. Update the summary table at the bottom with accurate counts

Commit the updated `BACKLOG.md` with message: `docs: update backlog status and add sequenced build plan`

---

## Acceptance Criteria

- Every 🔲 item from the original backlog has been classified with evidence (file path + finding)
- The build plan has no sequencing violations (a task does not appear before its dependency)
- All P0/P1 items appear before their P2/P3 counterparts within the same dependency chain
- Architectural risk flags are raised for any stub that violates a hard invariant
- `BACKLOG.md` is updated and committed
