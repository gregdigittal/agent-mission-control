# Prompt 10 — Per-Pane Project & Session Selection

## Goal

Add per-pane project and session selection to the React app (`app/`), matching the behaviour of the HTML MVP dashboard where each pane independently shows a different project's agents and kanban board. The bridge already discovers projects via `scanProjects()` and upserts them to Supabase's `projects` table — the UI just needs to consume them.

---

## Context — How the Codebase Works Today

### Bridge side (already complete — do not modify)
- `bridge/src/projects/scanner.ts` — scans `config.projects_root`, detects stack, upserts to Supabase `projects` table with `local_path` as the idempotency key
- `bridge/src/config.ts` — `projects_root` is already configured at `~/.agent-mc/config.json`

### React app — relevant files
- `src/types/index.ts` — `Session` has `projectId: string`; `Pane` has `id`, `sessionId`, `activeTab`
- `src/stores/sessionStore.ts` — holds `panes[]`, `sessions[]`, `setPaneSession(paneId, sessionId)`, `setPaneTab(paneId, tab)`
- `src/components/panes/PaneContainer.tsx` — renders per-pane content; shows "No session selected" placeholder when `pane.sessionId` is empty
- `src/components/panes/PaneTabBar.tsx` — tab bar rendered at the top of each pane when a session is active
- `src/components/topbar/SessionTabs.tsx` — currently assigns a session to the active pane by clicking a tab; this is NOT per-pane
- `src/hooks/useRealtimeSessions.ts` — subscribes to `agent_sessions` and populates `sessionStore.sessions`

### HTML dashboard behaviour to replicate
Each pane has its own session `<select>` dropdown in the pane header, independent of the other panes. Switching the dropdown in pane 2 does not affect pane 1. Multiple panes can show different projects simultaneously.

---

## What to Build

### 1. Add `projectId` to the `Pane` type

In `src/types/index.ts`, extend `Pane`:

```typescript
export interface Pane {
  id: string;
  sessionId: string;
  activeTab: PaneTab;
  projectId: string;  // ADD — which project this pane is scoped to
}
```

Update `buildPanes()` in `sessionStore.ts` to initialise `projectId: ''`.
Add `setPaneProject(paneId: string, projectId: string): void` to the store — it sets `projectId` and clears `sessionId` (changing project resets the session).

### 2. Add a `Project` type and `projectStore`

In `src/types/index.ts`, add:

```typescript
export interface Project {
  id: string;
  name: string;
  local_path: string;
  backlog_path: string | null;
  detected_stack: string[];
  last_scanned_at: string;
}
```

Create `src/stores/projectStore.ts` — a Zustand store with:
- `projects: Project[]`
- `setProjects(projects: Project[])`
- `addProject(project: Project)`
- `updateProject(id: string, updates: Partial<Project>)`

### 3. Add `useRealtimeProjects` hook

Create `src/hooks/useRealtimeProjects.ts` — follows the same pattern as `useRealtimeSessions.ts`:
- Initial load: `supabase.from('projects').select('*').order('name')`
- Realtime subscription on the `projects` table for INSERT/UPDATE
- Populates `projectStore`

Wire it into `App.tsx` alongside `useRealtimeSessions`.

### 4. Per-pane project + session selector in PaneContainer

Replace the "No session selected" placeholder in `PaneContainer.tsx` with a `PaneProjectSelector` component.

`PaneProjectSelector` renders when `pane.projectId` is empty OR `pane.sessionId` is empty:

**Step 1 — Project not selected:**
```
┌─────────────────────────────────┐
│  Select a project               │
│  ┌─────────────────────────┐   │
│  │ social-media-agent  ▾   │   │  ← dropdown of all projects from projectStore
│  └─────────────────────────┘   │
│  node · typescript              │  ← detected_stack badges
└─────────────────────────────────┘
```
Clicking a project calls `setPaneProject(paneId, project.id)`.

**Step 2 — Project selected, no session:**
```
┌─────────────────────────────────┐
│  ← social-media-agent           │  ← back button clears project
│                                 │
│  Active sessions                │
│  ○ Session A  (3 agents)        │  ← list of sessions for this project
│  ○ Session B  (idle)            │
│                                 │
│  [ + New session ]              │  ← creates a new agent_session row in Supabase
└─────────────────────────────────┘
```
Clicking a session calls `setPaneSession(paneId, session.id)`.
"New session" inserts a row into `agent_sessions` via Supabase and then calls `setPaneSession`.

Once a session is selected, `PaneContainer` renders the normal content (`AgentView`, `KanbanBoard`, etc.).

### 5. Per-pane project + session header (when session is active)

Update `PaneTabBar.tsx` to show the active project name and a session switcher dropdown in the pane header — matching the HTML dashboard's `pane-session-select`:

```
[ ◉ Agents ] [ ▦ Kanban ] [ ◎ Costs ]    social-media-agent / Session A ▾
```

The `▾` dropdown lists all sessions for the pane's current project. Selecting one calls `setPaneSession`. A "Change project" option at the bottom calls `setPaneProject(paneId, '')` which clears both projectId and sessionId, returning to step 1.

### 6. Remove global SessionTabs from Topbar (or demote it)

`SessionTabs` in the topbar currently assigns sessions globally to the active pane. This conflicts with per-pane selection. Two options — choose one:

**Option A (preferred):** Remove `SessionTabs` from the topbar entirely. Session assignment is now handled per-pane in `PaneTabBar`.

**Option B:** Keep it but rename it to a "quick jump" that only activates on the current active pane, with a visible label ("Active pane: Pane 2").

### 7. New session creation flow

When the user clicks "+ New session":
1. Prompt for a session name (inline input, not a modal — keep it lightweight)
2. Insert into `agent_sessions`: `{ name, project_id, created_at: now, color: nextSessionColor() }`
3. `useRealtimeSessions` picks up the INSERT and adds it to the store
4. Auto-select the new session in the pane

---

## Non-Goals (do not implement)

- Do not add project CRUD (create/delete/edit projects) — the bridge scanner owns project discovery
- Do not add session deletion UI — out of scope
- Do not touch the bridge — all changes are in `app/` only
- Do not change the mobile layout — `PaneProjectSelector` is desktop only; on mobile the bottom nav + single pane remain unchanged

---

## Files to Create

```
app/src/
├── types/index.ts                          ← add Project type, extend Pane
├── stores/projectStore.ts                  ← new
├── hooks/useRealtimeProjects.ts            ← new
└── components/panes/
    ├── PaneProjectSelector.tsx             ← new (steps 1 + 2 above)
    └── PaneTabBar.tsx                      ← modify: add project/session header
```

## Files to Modify

```
app/src/
├── types/index.ts
├── stores/sessionStore.ts                  ← add projectId to Pane, setPaneProject action
├── App.tsx                                 ← wire useRealtimeProjects
├── components/panes/PaneContainer.tsx      ← render PaneProjectSelector when no session
├── components/panes/PaneTabBar.tsx         ← add project/session switcher header
└── components/topbar/SessionTabs.tsx       ← remove or demote (Option A preferred)
```

---

## Constraints

- Follow all existing patterns: Zustand stores, `subscribeToTable` for realtime, `isSupabaseConfigured()` guard before all Supabase calls
- Strict TypeScript — no `any`, no `// @ts-ignore`
- Design tokens only — `var(--bg-*)`, `var(--text-*)`, `var(--cyan)` etc. — no hardcoded colours
- `PaneProjectSelector` is a pure presentational component — no direct Supabase calls in component body; use stores and hooks
- Run `npx tsc --noEmit` after implementation — must pass with zero errors

---

## Acceptance Criteria

1. With 2+ panes open, each pane independently shows a different project and different session
2. Changing the project in pane 1 does not affect pane 2
3. Sessions list filters to only sessions that belong to the selected project (`session.projectId === project.id`)
4. Creating a new session via the UI creates an `agent_sessions` row in Supabase and auto-selects it in the pane
5. The pane header (PaneTabBar) shows `<project name> / <session name>` with a working session switcher dropdown
6. `tsc --noEmit` exits 0
