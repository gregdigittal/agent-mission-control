# Agent Mission Control

Real-time dashboard for monitoring Claude Code agent teams. Single HTML file, zero dependencies, no build step.

## Quick Start

Open `index.html` directly in a browser, or serve locally:

```sh
python3 -m http.server 8090
# then visit http://localhost:8090/index.html
```

## Project Structure

- `index.html` — Complete dashboard (HTML + CSS + JS in one file)
- `agent_state.json` — Example data file for File Watch mode
- `CLAUDE.md` — This file

## Architecture

All state lives in the `S` object (no localStorage). Rendering uses safe DOM methods via helper functions:
- `h(tag, props)` — createElement with className, textContent, event listeners, data attributes
- `svgNS(tag, attrs)` — createElementNS for SVG elements
- `txt(s)` — createTextNode
- `clear(el)` — remove all children

**Security**: Only safe DOM APIs are used (createElement, textContent, appendChild). No unsafe HTML string injection methods anywhere.

## Features

- **Session management**: Two demo sessions (CCRS E-Signature, CE Africa Valuation) plus "+" button to add custom sessions, "×" to remove
- **Tiling window manager**: 1-4 panes, each with independent session/view selectors
- **Agent View**: Progress ring, pipeline stage pills, agent cards with status/metrics, activity feed with filters
- **Kanban Board**: 4 columns with HTML5 drag-and-drop, Claude recommendation badges, approve/reject workflow
- **Simulation engine**: Ticks every 3.2s, generates events, updates agent statuses, progresses tasks
- **Screen profiles**: Laptop 14" (max 2 panes), Desktop 27" (3 panes), Ultrawide 49" (4 panes)
- **File Watch mode**: Press F to toggle bar, polls `agent_state.json` every 3 seconds

## File Watch JSON Schema

Place an `agent_state.json` file next to `index.html` (or specify a path) with this structure:

```json
{
  "project": "string",
  "currentStageIdx": 0,
  "totalTasks": 24,
  "completedTasks": 9,
  "stages": [{"name": "string", "desc": "string", "status": "completed|active|pending"}],
  "agents": [{"id": "string", "name": "string", "role": "string", "type": "leader|backend|frontend|tester|reviewer", "status": "working|thinking|idle|error|leader", "icon": "emoji", "task": "string", "metrics": {"ctx": "42%", "cost": "$0.83", "msgs": 47}}],
  "events": [{"agent": "string", "type": "tool|file|task|message|thinking|error", "text": "string", "timestamp": "HH:MM:SS"}]
}
```

## Design Tokens

- **Fonts**: Geist Mono (code/UI), Geist Sans (labels) — loaded via jsDelivr CDN
- **Background**: #06080c to #242b3d (6-step ramp)
- **Accents**: Cyan #22d3ee, Green #34d399, Amber #fbbf24, Red #f87171, Violet #a78bfa, Blue #60a5fa, Rose #fb7185
- **Scanline overlay**: repeating-linear-gradient on body::after

## Conventions

- All DOM creation uses `h()` helper — only safe DOM APIs (createElement, textContent, appendChild)
- CSS custom properties for all spacing/sizing to support density profiles
- Event listeners via `h()` props: `{onclick: fn}` becomes addEventListener('click', fn)
- SVG via `svgNS()` with createElementNS
