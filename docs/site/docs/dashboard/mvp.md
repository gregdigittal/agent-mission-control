---
id: mvp
title: MVP Dashboard
sidebar_position: 1
---

# MVP Dashboard

The MVP dashboard is `dashboard/index.html` — a single-file static web application with no build step required. It runs in any browser and can be served from a VPS with a single command.

## Features

- Real-time agent status display (via Supabase Realtime or file polling)
- Session management
- Agent card grid with cost, context usage, and status badges
- Kanban task board
- Approval workflow for gated actions
- Cost monitoring
- Keyboard shortcuts

## Deploying

### Serve locally

```bash
cd dashboard
python3 -m http.server 8090
# Open http://localhost:8090
```

### Serve on a VPS

Any static file server works. The simplest option:

```bash
# Using Python (no install required)
cd dashboard && python3 -m http.server 8090 &

# Or using npx serve
npx serve dashboard -p 8090
```

For production, put it behind a TLS reverse proxy. See [TLS / Reverse Proxy](../infra/tls).

## Configuration

Before deploying, edit the configuration block at the top of `dashboard/index.html`.

The dashboard can operate in two modes:

### File Watch Mode (default — no Supabase required)

The dashboard polls `agent_state.json` from the same directory. The bridge writes this file automatically. No credentials needed.

### Supabase Mode

For multi-device access and real-time updates via Supabase Realtime, set your Supabase project credentials in the configuration block:

```javascript
// TODO: replace with your Supabase project values
// Settings → API in the Supabase dashboard
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

:::warning
Never commit real credentials to source control. The configuration block is intentionally marked with `TODO` comments. Edit the deployed file, not the source.
:::

## Docker

The root `docker-compose.yml` includes a `dashboard` service that serves `dashboard/index.html` via nginx on port 8090:

```bash
docker compose up -d dashboard
# Open http://localhost:8090
```

The `agent_state.json` file is mounted as a read-only volume so the container reflects live bridge state.

## Browser Compatibility

Requires a modern browser with ES2020+ support (Chrome 89+, Firefox 78+, Safari 14+). The dashboard uses CSS custom properties and native `fetch` — no polyfills.
