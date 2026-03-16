---
id: getting-started
title: Getting Started
sidebar_position: 1
---

# Getting Started

Agent Mission Control (AMC) lets you orchestrate teams of Claude Code AI agents across git worktrees, with a real-time dashboard for monitoring sessions, managing tasks, and controlling costs.

## Prerequisites

- **Node.js 20+** LTS
- **Git** (2.30+ recommended for worktree support)
- **Claude Code CLI** — installed and authenticated (`claude --version`)
- A **Supabase project** (optional — AMC works offline with filesystem IPC)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/agent-mission-control/agent-mission-control
cd agent-mission-control
```

### 2. Install and configure the bridge

The bridge is the orchestration daemon that runs on your VPS or local machine.

```bash
cd bridge
./install.sh /path/to/your/repo
```

The install script:
1. Creates the `~/.agent-mc/` directory structure
2. Installs Node.js dependencies and builds TypeScript
3. Generates a cryptographically secure session token
4. Writes a default `config.json`

### 3. Start the bridge

```bash
cd bridge
npm start
```

The bridge starts its 2-second main loop: health checks → command processing → state aggregation → optional Supabase sync.

### 4. Open the dashboard

**MVP dashboard** (static, no build step):

```bash
cd dashboard
python3 -m http.server 8090
# Open http://localhost:8090
```

**React app** (full-featured, requires build):

```bash
cd app
cp .env.example .env   # add your Supabase credentials
npm install
npm run dev
# Open http://localhost:5173
```

## What the Bridge Creates

After `install.sh` runs, your `~/.agent-mc/` directory contains:

```
~/.agent-mc/
├── commands/           # Dashboard → Bridge IPC commands
│   └── .processed/     # Archived processed commands
├── state/              # Bridge → Dashboard state files
│   ├── dashboard_state.json
│   └── agents/
├── logs/               # Append-only JSONL audit trail
├── worktrees/          # Git worktrees (one per agent)
├── config.json         # Bridge configuration
└── .session_token      # Auth token (chmod 600)
```

## Supabase Integration (optional)

To enable remote access and multi-device dashboard support, configure Supabase in `~/.agent-mc/config.json`:

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anon_key": "your-anon-key",
    "enabled": true
  }
}
```

The bridge works fully offline without Supabase. Supabase is used for persistent history, auth, and multi-device access.

## Next Steps

- [Architecture](./architecture) — understand the system design
- [Bridge Configuration](./bridge/configuration) — all config options
- [Running in Production](./bridge/production) — systemd and PM2 setup
- [TLS / Reverse Proxy](./infra/tls) — HTTPS for the dashboard
