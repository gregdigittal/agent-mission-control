# Agent Mission Control

Real-time dashboard for monitoring Claude Code agent teams. Single HTML file — zero dependencies, no build step, works with `file://`.

---

## Quick Start

```sh
# Option A: open directly in browser
open index.html

# Option B: serve locally (needed for File Watch mode in some browsers)
python3 -m http.server 8090
# then visit http://localhost:8090
```

On first load a screen-size selector modal appears. Pick your monitor size and click **Open Mission Control**.

---

## Modes

### Simulation Mode (default)

Loads automatically with two demo sessions — *CCRS E-Signature* and *CE Africa Valuation* — running realistic simulated agent activity. No setup required.

### File Watch Mode

Polls `agent_state.json` every 3 seconds and reflects live agent state.

1. Write (or pipe) your agent state to `agent_state.json` next to `index.html`.
2. Click **File Watch → START** in the bottom bar (or press `F` to toggle the bar).
3. A **File Watch** session tab appears, showing live data alongside any simulation sessions.

If `agent_state.json` is already present when the page loads, File Watch starts automatically.

---

## Connecting Claude Code Agents

### Option 1 — Shell hook (recommended)

After each tool call, your Claude Code session writes state to disk:

```sh
# Minimal: project name + progress
./hooks/write_state.sh --project "My Project" 3 24 9
#                                               ^  ^  ^
#                                  stage_idx(0-7)  total  done

# Full JSON: pipe a complete agent_state.json
cat my_state.json | ./hooks/write_state.sh

# From environment variables (for .claude/hooks/post-tool.sh)
AMC_PROJECT="My Project" AMC_STAGE_IDX=3 AMC_TOTAL=24 AMC_DONE=9 \
  ./hooks/write_state.sh --from-env
```

### Option 2 — Write `agent_state.json` directly

Any process can write the file. Mission Control polls and merges updates.

### Option 3 — Supabase relay (multi-machine / hosted)

Push state to a Supabase edge function so any browser can watch a live session without sharing a filesystem.

**One-time setup:**
```sh
# Deploy the edge function (requires Supabase CLI)
supabase functions deploy ingest-state --project-ref <your-project-ref>

# Set the auth secret
supabase secrets set AMC_WRITE_SECRET=<your-secret> --project-ref <your-project-ref>
```

**From agents (add to your push hook):**
```sh
export AMC_SUPABASE_URL="https://<your-ref>.supabase.co"
export AMC_SUPABASE_KEY="<your-anon-key>"
cat agent_state.json | ./hooks/write_state.sh
```

**In the dashboard:**
1. Click **FILE ▾** in the bottom bar → switch to **SUPABASE**
2. Enter your Supabase project URL and anon key → click **START**

The hosted dashboard at `https://agent-mission-control-ruddy.vercel.app` works the same way — just point it at your Supabase project.

---

## `agent_state.json` Schema

See `agent_state_example.json` for a fully annotated example. Key fields:

```json
{
  "project": "string",
  "currentStageIdx": 0,
  "totalTasks": 24,
  "completedTasks": 9,
  "stages": [
    { "name": "Planning", "desc": "...", "status": "completed|active|pending" }
  ],
  "agents": [
    {
      "id": "unique-id",
      "name": "Alex Chen",
      "role": "Backend Dev",
      "type": "leader|backend|frontend|tester|reviewer",
      "status": "working|thinking|idle|error|leader",
      "icon": "⚙️",
      "task": "Current task description",
      "taskId": "t10",
      "metrics": { "ctx": "42%", "cost": "$0.83", "msgs": 47 }
    }
  ],
  "tasks": [
    {
      "id": "t10",
      "title": "Implement auth middleware",
      "status": "backlog|in-progress|review|done",
      "assignee": "Alex Chen",
      "priority": "high|medium|low",
      "deps": ["t9"],
      "rec": false,
      "recWhy": "Reason shown when rec=true (permission request)"
    }
  ],
  "events": [
    { "agent": "Alex Chen", "type": "tool|file|task|message|thinking|error",
      "text": "Running npm test", "timestamp": "14:32:18" }
  ]
}
```

**`taskId`** on an agent links it to a Kanban card — the card shows a live agent indicator.
**`rec: true`** on a task shows a permission-request badge with Approve/Deny buttons.

---

## Screen Profiles

| Profile | Max Panes | Density |
|---------|-----------|---------|
| 14″ Laptop | 2 | Compact |
| 27″ Desktop | 3 | Standard |
| 49″ Ultrawide | 4 | Expanded |

Switch via the buttons in the top-right or with keyboard shortcuts.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` `2` `3` `4` | Switch pane layout |
| `L` | 14″ Laptop profile |
| `D` | 27″ Desktop profile |
| `U` | 49″ Ultrawide profile |
| `F` | Toggle File Watch bar |
| `?` | Toggle shortcut help panel |

---

## Pane Layout

Each pane is independent:
- **Session selector** — assign any loaded session to any pane
- **View selector** — switch between Agent View and Kanban Board per pane

To add a session: click **+ Add** in the topbar. Sessions discovered via `./discover_sessions.sh` appear in the dropdown.

```sh
# Regenerate available_sessions.json (run from project root)
./discover_sessions.sh
```

---

## Kanban Features

- **Drag and drop** between columns (within the same session)
- **Permission badges** — `rec: true` tasks show an Approve/Deny workflow
- **Dependency pull** — moving a task to In Progress surfaces its blocked dependencies for approval
- **Agent indicators** — cards show which agent is currently working on them (via `taskId` link)
- **Transition detection** — when File Watch detects a status change not yet user-approved, it surfaces a Confirm/Revert prompt

---

## Troubleshooting

**File Watch shows an error banner**
The browser cannot reach `agent_state.json`. If opening via `file://`, some browsers block local file fetches — serve with `python3 -m http.server 8090` instead.

**No sessions visible**
The demo simulation sessions should appear automatically. If they don't, check the browser console for JS errors.

**discover_sessions.sh not found**
The `+Add` dropdown reads `available_sessions.json` produced by `./discover_sessions.sh`. Run that script first from the project root.

---

## Architecture

Single-file (`index.html`) with no build tools, no npm, no framework.

**JS structure:**
- `AMC.State` — session data, pane layout, screen profile
- `AMC.Sim` — simulation engine (tick-based, per-session intervals)
- `AMC.Data` — file watch polling, JSON merge, auto-detect
- `AMC.Render` — all DOM rendering (safe APIs only — no innerHTML)
- `AMC.UI` — clock, keyboard shortcuts, modals, error banners

**Security:** Only safe DOM APIs are used (`createElement`, `textContent`, `appendChild`). No `innerHTML` anywhere.
