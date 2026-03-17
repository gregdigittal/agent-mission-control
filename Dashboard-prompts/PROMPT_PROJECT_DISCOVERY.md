# Agent Mission Control — Project Discovery

## Purpose

This prompt wires Agent Mission Control to a configurable **projects root folder**
(`~/Development/` by default) so that:

1. The bridge auto-discovers every git repo under that folder — no code changes needed
   when a new project is added.
2. Each discovered project is registered in Supabase and shown in the dashboard.
3. When a Claude session is started for a project, its backlog (`BACKLOG.md`) is
   parsed and its tasks appear in the dashboard kanban board automatically.
4. The dashboard project selector lists every discovered project — picking one
   scopes all views (agents, kanban, costs, events) to that project.

---

## Pre-Flight

Working directory: `/home/gregmorris/agent-mission-control/`

Before doing anything else:

1. Confirm MCP access to the Supabase project:
   ```
   Project ID: zpsnbogldtepmfwgqarz   Region: eu-west-1
   ```
   Use the Supabase MCP tool to run a test query:
   `SELECT id, name FROM projects LIMIT 1;`
   If that fails, stop and report — do not proceed without DB access.

2. Read these files in full before writing a single line of code:
   - `bridge/src/config.ts` — understand `BridgeConfigSchema`
   - `bridge/src/supabase/sync.ts` — understand what is already synced
   - `bridge/src/supabase/client.ts` — understand how Supabase is accessed
   - `app/src/stores/sessionStore.ts` — understand session/project state shape
   - `app/src/hooks/useWorkspaces.ts` — understand workspace hook pattern
   - `supabase/migrations/002_rls_policies.sql` — understand existing RLS approach
   - `FUNCTIONAL_SPEC.md` — understand the `projects` table intent

---

## Task 1 — DB: Extend the `projects` table via MCP

Use the Supabase MCP tool to run the following SQL directly against the
`zpsnbogldtepmfwgqarz` project. Do NOT create a migration file — apply it live.

```sql
-- Extend the projects table for filesystem-backed discovery.
-- Safe to run repeatedly (all changes are idempotent).

-- 1. Add the local filesystem path for this project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS local_path text,
  ADD COLUMN IF NOT EXISTS backlog_path text,
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS detected_stack text[];   -- e.g. ['typescript','react','node']

-- 2. Unique index on local_path so upserts are conflict-safe
CREATE UNIQUE INDEX IF NOT EXISTS projects_local_path_idx
  ON projects (local_path)
  WHERE local_path IS NOT NULL;

-- 3. Extend kanban_tasks to hold the raw backlog source text and an
--    external task ID (e.g. "M3-004") so re-imports are idempotent
ALTER TABLE kanban_tasks
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('backlog', 'manual', 'agent')),
  ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('P0','P1','P2','P3'));

-- Unique index: one row per (project_id, external_id) so backlog re-imports
-- update existing rows rather than duplicating them.
CREATE UNIQUE INDEX IF NOT EXISTS kanban_tasks_external_id_idx
  ON kanban_tasks (project_id, external_id)
  WHERE external_id IS NOT NULL;

-- 4. RLS: project owner can read their own projects (if not already set)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects: owner can select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "projects: owner can select"
        ON projects FOR SELECT TO authenticated
        USING (owner_id = auth.uid());
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects: owner can insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "projects: owner can insert"
        ON projects FOR INSERT TO authenticated
        WITH CHECK (owner_id = auth.uid());
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects: owner can update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "projects: owner can update"
        ON projects FOR UPDATE TO authenticated
        USING (owner_id = auth.uid());
    $policy$;
  END IF;
END;
$$;
```

After running, verify with MCP:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('projects', 'kanban_tasks')
  AND column_name IN ('local_path','backlog_path','last_scanned_at',
                      'external_id','source','priority','detected_stack')
ORDER BY table_name, column_name;
```
All 7 columns must appear. If any are missing, do not proceed.

---

## Task 2 — Bridge: Project scanner

Create `bridge/src/projects/scanner.ts`.

**Behaviour:**
- Reads `config.projects_root` (e.g. `/home/gregmorris/Development`)
- Scans all immediate subdirectories for `.git/` — any dir with `.git/` is a project
- For each discovered project:
  - Derives `name` from the directory name
  - Checks for `BACKLOG.md` at the project root
  - Detects the tech stack by checking for: `package.json` (node/ts), `pyproject.toml`
    or `requirements.txt` (python), `go.mod` (go), `Cargo.toml` (rust),
    `composer.json` (php)
  - Upserts into Supabase `projects` table using `local_path` as the conflict key
  - Sets `last_scanned_at` to now
- Returns an array of discovered project records

**Rules:**
- Use `node:fs/promises` — no third-party filesystem libs
- Depth is exactly 1 level (immediate children of `projects_root` only)
- Silently skip directories that are not git repos (no `.git/`)
- If `projects_root` does not exist or is not a directory, log a warning and return `[]`
- Upsert uses `local_path` as the conflict target — never creates duplicates
- The Supabase upsert uses the service role client (not the anon client) — import
  `getSupabaseAdminClient` or create it if it does not exist. The service role key
  comes from `process.env.SUPABASE_SERVICE_ROLE_KEY` — never hardcode it.

**New config field to add to `BridgeConfigSchema` in `bridge/src/config.ts`:**
```typescript
projects_root: z.string().optional(),  // default: undefined (scanner disabled)
```

Write tests in `bridge/src/projects/scanner.test.ts`:
- scanner returns empty array when `projects_root` is not set
- scanner skips directories without `.git/`
- scanner detects node/typescript stack from `package.json`
- scanner detects python stack from `requirements.txt`
- scanner sets `backlog_path` when `BACKLOG.md` exists, null when it does not
- upsert is called with correct `local_path` conflict key

---

## Task 3 — Bridge: Backlog parser

Create `bridge/src/projects/backlogParser.ts`.

**Behaviour:**
- Accepts a path to a `BACKLOG.md` file
- Parses task rows out of markdown tables using this pattern:
  - Lines matching `| ID | Title | Priority | Effort | ... |`
  - Extracts: `id` (e.g. `M3-004`), `title`, `priority` (`P0`–`P3`), `status`
    (maps `✅ Done` → `done`, `🔲` → `backlog`, `🚧` or `In Progress` → `in_progress`,
    `❌ Removed` → skip entirely)
- Returns `ParsedTask[]`:
  ```typescript
  interface ParsedTask {
    external_id: string;   // the ID column, e.g. "M3-004"
    title: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
    status: 'backlog' | 'in_progress' | 'done';
    effort: string | null; // raw effort string, e.g. "M", "L", "XL"
  }
  ```
- Is tolerant: if a row is malformed, skip it rather than throwing
- Does NOT touch Supabase — pure parsing only

Write tests in `bridge/src/projects/backlogParser.test.ts`:
- parses a P0 backlog item correctly
- maps ✅ Done to status `done`
- maps 🔲 to status `backlog`
- skips rows marked ❌ Removed
- skips malformed rows without throwing
- returns empty array for empty file
- returns empty array when no table rows are present

---

## Task 4 — Bridge: Session-start backlog import

Modify `bridge/src/commands/spawn.ts`.

When a `spawn_agent` command includes a `project_path` field in its payload:
1. Look up the project in Supabase by `local_path = project_path`
2. If the project has a `backlog_path`, read and parse it with `backlogParser`
3. Upsert the parsed tasks into `kanban_tasks` using `(project_id, external_id)` as
   the conflict target
4. Set `source = 'backlog'` on all upserted rows
5. Proceed with normal agent spawning — the backlog import is a pre-spawn step,
   not a blocking dependency (wrap in try/catch, log warning on failure, do not abort)

Add `project_path?: string` to the `SpawnPayload` interface.

---

## Task 5 — App: `useProjects` hook

Create `app/src/hooks/useProjects.ts`.

**Behaviour:**
- Queries `projects` table ordered by `name ASC`
- Returns `{ projects, loading, error }`
- Each project record includes: `id`, `name`, `local_path`, `description`,
  `detected_stack`, `last_scanned_at`, `backlog_path`
- Refreshes when the Supabase Realtime `projects` channel fires an INSERT or UPDATE
- Falls back to empty array on error (logs warning, does not throw)

Write tests in `app/src/hooks/useProjects.test.ts` (jsdom environment):
- returns empty array when Supabase is not configured
- maps rows correctly (id, name, local_path, detected_stack)
- falls back to empty array on fetch error

---

## Task 6 — App: Project selector in session spawn flow

Modify `app/src/components/agents/AgentView.tsx` (or wherever the "spawn agent"
action lives — read the file before touching it).

Add a **project selector** dropdown to the spawn form:
- Populated from `useProjects()`
- Selecting a project sets `project_path` in the spawn payload
- Shows project name + detected stack badges (e.g. `[ts]`, `[py]`)
- If only one project exists, pre-select it
- "No project" is a valid selection (project_path omitted from payload)

Add a **project filter** to the session list / dashboard header:
- Dropdown listing all discovered projects + "All projects"
- When a project is selected, the agents view, kanban board, costs, and events
  are all filtered to sessions for that `project_id`
- Selection is stored in `sessionStore` as `activeProjectId: string | null`

**Architecture rule:** Do not add `project_path` hardcoding anywhere in the UI.
The list comes from `useProjects()` which reads from Supabase, which was populated
by the bridge scanner. Adding a new project to `~/Development/` requires only a
bridge scanner run — zero UI or code changes.

---

## Task 7 — Bridge: Wire scanner into main loop

Modify `bridge/src/index.ts`.

- On startup: run the project scanner once (if `config.projects_root` is set)
- Every 5 minutes during the main loop: re-run the scanner to pick up newly added
  projects. Use a counter rather than a separate setInterval — keep the main loop
  as the single scheduler.
- Log discovered/updated project count at INFO level
- If `config.projects_root` is not set, log a single INFO message at startup:
  `[projects] projects_root not configured — project discovery disabled`
  and skip silently on all subsequent cycles.

---

## Task 8 — Config: Update `~/.agent-mc/config.json` documentation

Update `docs/site/docs/bridge/configuration.md` to add the `projects_root` field:

| Key | Default | Description |
|-----|---------|-------------|
| `projects_root` | — | Path to your projects folder. The bridge scans immediate subdirectories for git repos and registers them in Supabase. Example: `/home/gregmorris/Development` |

---

## Acceptance Criteria

- [ ] MCP SQL ran cleanly — `local_path`, `backlog_path`, `external_id`, `source`,
      `priority`, `detected_stack`, `last_scanned_at` all exist in the DB
- [ ] `bridge/src/projects/scanner.ts` + tests — all tests pass
- [ ] `bridge/src/projects/backlogParser.ts` + tests — all tests pass
- [ ] `bridge/src/commands/spawn.ts` accepts `project_path`, imports backlog on spawn
- [ ] `app/src/hooks/useProjects.ts` + tests — all tests pass
- [ ] Dashboard project selector populated from live Supabase data
- [ ] Adding a new git repo to `~/Development/` and restarting the bridge (or waiting
      5 min) causes it to appear in the dashboard — zero code changes required
- [ ] `cd bridge && npm test` — 0 failures
- [ ] `cd bridge && npx tsc --noEmit` — 0 errors
- [ ] `cd app && npm test` — 0 failures
- [ ] `cd app && npx tsc --noEmit` — 0 errors

---

## Implementation Notes

### Project discovery is zero-config for end users

The only required change to make a new project available:
1. It must be a git repo (has `.git/`)
2. It must be a direct child of `projects_root`
3. Optionally: have a `BACKLOG.md` at root for task import

No schema changes, no config edits, no code changes.

### Backlog format is advisory

The parser handles `BACKLOG.md` files that follow the table format used in this repo.
If a project has no `BACKLOG.md`, or uses a different format, it simply has no
pre-populated tasks — the kanban board starts empty and tasks can be added manually.
The parser must never error on unexpected input.

### Service role key for bridge upserts

The bridge scanner writes to `projects` using the Supabase service role key because
the bridge is a trusted server-side process. The service role key must come from
`process.env.SUPABASE_SERVICE_ROLE_KEY`. Add it to `bridge/src/config.ts` as an
optional env var (separate from `config.json` — secrets never go in config files):

```typescript
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
```

Document it in `CLAUDE.md` under the bridge env vars section.

### Active project scoping in the dashboard

The `activeProjectId` filter in the dashboard does NOT change the Supabase queries —
it is a client-side filter on top of the existing data already loaded. This avoids
refactoring all existing hooks. The only exception is `useProjects()` which is a
new, targeted query.
