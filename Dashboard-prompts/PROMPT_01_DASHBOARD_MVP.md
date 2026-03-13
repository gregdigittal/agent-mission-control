# PROMPT 01: Personal Dashboard MVP

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first for full project context.
> **Deliverables:** `dashboard/index.html`, `dashboard/agent_state_example.json`, `dashboard/hooks/write_state.sh`
> **Estimated effort:** 1 Claude Code session

---

## Objective

Build a single-file HTML/CSS/JS dashboard that monitors Claude Code agent teams in real-time. It must be served via HTTP from a VPS (e.g., `python3 -m http.server 8080` or nginx) and be fully usable from a phone for mobile orchestration.

This is my personal tool. I run Claude Code on a Hetzner VPS and access the dashboard from a Mac with a 49-inch ultrawide monitor AND from my phone.

## Architecture

- **Single file:** All CSS in `<style>`, all JS in `<script>`
- **Served via HTTP** on VPS (NOT file:// — we need this remotely accessible)
- **Google Fonts CDN:** `JetBrains Mono` (monospace) + `DM Sans` (UI text)
- **Data:** Supabase Realtime (primary) with `agent_state.json` polling fallback

### Data Layer: Two Modes

**Supabase Mode (primary when configured):**
- Connects to Supabase project `zpsnbogldtepmfwgqarz`
- Subscribes to Realtime changes on: `agents`, `events`, `kanban_tasks`, `agent_sessions`
- Include Supabase JS client via CDN: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
- Configuration via JS constants at top of file (SUPABASE_URL, SUPABASE_ANON_KEY)
- Falls back to simulation if connection fails

**File Watch Mode (fallback):**
- Reads `agent_state.json` via `fetch()` polled every 3 seconds
- For when Supabase isn't configured or is unreachable

**Simulation Mode (demo):**
- Built-in hardcoded data for demos
- Events push every ~3 seconds
- Agent states evolve realistically

Toggle between modes via a dropdown in the topbar.

## Responsive Design — 4 Screen Profiles

The dashboard MUST work on phones. This is critical — I need to approve agent actions and check status from my phone.

| Profile | Breakpoint | Max Panes | Detection |
|---------|-----------|-----------|-----------|
| Mobile | < 768px | 1 | Auto-detect via `matchMedia`, or manual picker |
| Laptop | 768-1440px | 2 | Manual picker |
| Desktop | 1441-2560px | 3 | Manual picker |
| Ultrawide | > 2560px | 4 | Manual picker |

### Mobile Layout Requirements

When on mobile (`screen-mobile` class or viewport < 768px):

1. **Single-pane, full-width layout** — no tiling
2. **Bottom navigation bar** (fixed, 56px) with 4 tabs:
   - 📊 Agents (agent status + activity stream)
   - 📋 Kanban (task board)
   - 💰 Costs (per-agent spending)
   - ✅ Approvals (pending actions queue)
3. **Topbar collapses** — show only: session selector dropdown + live indicator + hamburger menu
4. **Hamburger menu** opens: session list, screen profile override, data source toggle, settings
5. **Agent cards stack vertically**, full-width, with collapsible details (tap to expand)
6. **Kanban columns** use horizontal scroll (swipe left/right between columns) or vertical stack with column headers as accordions
7. **Approval actions are prominent** — large touch-friendly buttons (min 44px tap targets per Apple HIG)
8. **Pull-to-refresh** gesture for manual data refresh
9. **Session switching** via horizontal swipe or dropdown
10. **Push notification badge** on Approvals tab when pending items exist

### CSS Custom Properties (All Profiles)

```css
html.screen-mobile {
  --density-pad: 8px;
  --density-gap: 6px;
  --pane-min: 100%;
  --topbar-h: 48px;
  --font-base: 14px;  /* Larger for touch readability */
  --font-sm: 12px;
  --font-xs: 11px;
  --font-xxs: 10px;
  --card-pad: 12px;
  --kb-col-w: calc(100vw - 32px);
  --bb-stage-size: 14px;
  --bb-ring-size: 48px;
  --bb-stat-size: 14px;
  --bottomnav-h: 56px;
  --tap-target: 44px;
}

html.screen-laptop {
  --density-pad: 10px;
  --density-gap: 7px;
  --pane-min: 320px;
  --topbar-h: 36px;
  --font-base: 12px;
  --font-sm: 10px;
  --font-xs: 9px;
  --font-xxs: 8px;
  --card-pad: 8px 10px;
  --kb-col-w: 180px;
  --bb-stage-size: 15px;
  --bb-ring-size: 42px;
  --bb-stat-size: 15px;
}

html.screen-desktop {
  --density-pad: 14px;
  --density-gap: 10px;
  --pane-min: 360px;
  --topbar-h: 40px;
  --font-base: 13px;
  --font-sm: 11px;
  --font-xs: 10px;
  --font-xxs: 9px;
  --card-pad: 12px 14px;
  --kb-col-w: 210px;
  --bb-stage-size: 17px;
  --bb-ring-size: 54px;
  --bb-stat-size: 17px;
}

html.screen-ultrawide {
  --density-pad: 18px;
  --density-gap: 12px;
  --pane-min: 400px;
  --topbar-h: 44px;
  --font-base: 14px;
  --font-sm: 12px;
  --font-xs: 11px;
  --font-xxs: 10px;
  --card-pad: 14px 16px;
  --kb-col-w: 240px;
  --bb-stage-size: 20px;
  --bb-ring-size: 62px;
  --bb-stat-size: 20px;
}
```

## Color Palette

```css
:root {
  --bg-0: #06080c;
  --bg-1: #0b0e14;
  --bg-2: #10141c;
  --bg-3: #161b26;
  --bg-4: #1c2232;
  --bg-5: #242b3d;
  --border-0: #1a2030;
  --border-1: #242e42;
  --border-2: #2e3a52;
  --text-0: #edf0f7;
  --text-1: #b0b8cc;
  --text-2: #6e7a94;
  --text-3: #3e4a64;
  --cyan: #22d3ee;
  --green: #34d399;
  --amber: #fbbf24;
  --red: #f87171;
  --violet: #a78bfa;
  --blue: #60a5fa;
  --rose: #fb7185;
}
```

## Desktop Features (Same as Original Spec)

### Tiling Window System
- 1-4 panes (side-by-side vertical columns)
- Each pane has: tab bar (◉ Agents / ▦ Kanban), session selector, independent scroll
- Tile picker in topbar, constrained by screen profile

### Sessions
- Multiple concurrent sessions, color-coded tabs
- "+ Session" button, "✕" close (when >1)
- Each session has independent state/simulation

### Agent View Components (per pane)
- **Build Stage Banner:** stage name, project name, SVG progress ring, stats
- **Pipeline Row:** 8 stages as cards (Planning → Review)
- **Agent Cards:** emoji avatar, name, role, status badge, task, metrics (ctx%, cost, msgs), files
- **Activity Stream:** reverse-chron feed, filterable (All/Tasks/Files/Tools/Messages), animated entry

### Kanban Board (per pane)
- 4 columns: Backlog, To Do, In Progress, Done
- Drag-and-drop (HTML5 Drag on desktop, touch events on mobile)
- Claude recommendation badge (🤖) + approve button
- Task tags, priorities, agent assignment

## Visual Effects
- Scanline overlay on `body::after` (desktop only — disable on mobile for performance)
- Pulse animation on live badge
- Cyan glow on active pipeline stages + progress ring
- `feed-in` animation on new events
- Card hover effects (desktop only)
- Custom thin scrollbars (desktop only)

## Keyboard Shortcuts (Desktop Only)
- `L/D/U` for screen profiles
- `1-4` for layout switching
- `A` for agents view, `K` for kanban view in active pane

## JS Architecture

Organize into clearly separated sections:
```
// === CONFIG ===        Supabase URL/key, feature flags
// === STATE ===         All state variables
// === SUPABASE ===      Client setup, realtime subscriptions
// === SIMULATION ===    Demo data generators
// === DATA ===          File watch polling, state merging
// === RENDERING ===     All DOM generation (desktop + mobile)
// === MOBILE ===        Bottom nav, swipe, pull-to-refresh
// === DRAG & DROP ===   Kanban handlers (mouse + touch)
// === EVENTS ===        UI binding, keyboard shortcuts
// === INIT ===          Startup, screen detection, mode selection
```

## Serving on VPS

Include comments at the top of `index.html` explaining how to serve:

```html
<!--
  Agent Mission Control — Personal Dashboard
  
  Quick start:
    cd /path/to/dashboard
    python3 -m http.server 8080
    # Access at http://your-vps-ip:8080
  
  Or with nginx:
    server {
      listen 8080;
      root /path/to/dashboard;
      index index.html;
    }
  
  Configure Supabase (optional):
    Edit SUPABASE_URL and SUPABASE_ANON_KEY below
-->
```

## Deliverables

1. `dashboard/index.html` — complete dashboard (single file, ~3000-5000 lines)
2. `dashboard/agent_state_example.json` — example data file
3. `dashboard/hooks/write_state.sh` — hook for Claude Code to write agent state

## Acceptance Criteria

- [ ] Accessible via `http://vps-ip:8080` from any device
- [ ] Mobile layout works on iPhone/Android (< 768px viewport)
- [ ] Bottom nav on mobile with Agents/Kanban/Costs/Approvals tabs
- [ ] Approval actions usable on mobile with touch-friendly buttons
- [ ] Pull-to-refresh works on mobile
- [ ] Screen profiles switch correctly (mobile auto-detected, others via picker)
- [ ] Tiling system works on desktop (1-4 panes)
- [ ] Agent View: build banner + pipeline + agent cards + activity stream
- [ ] Kanban: 4 columns, drag-and-drop (mouse + touch), approval workflow
- [ ] Supabase Realtime updates in < 1 second when configured
- [ ] File Watch fallback works when Supabase not configured
- [ ] Simulation mode runs with realistic data
- [ ] Dark mission-control aesthetic
- [ ] Keyboard shortcuts on desktop
