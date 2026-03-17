---
id: setup-multi-vps
title: Set Up Multi-VPS Orchestration
sidebar_position: 2
---

# Set Up Multi-VPS Orchestration

This tutorial shows you how to run agents across two or more VPS nodes and view all activity from a single dashboard.

## Overview

In a multi-VPS setup:

- **Primary node** — runs your main bridge instance and coordinates all nodes
- **Remote nodes** — run lightweight bridge instances; agents execute locally and push state back to primary

All state is aggregated in a single Supabase project so the dashboard shows agents from every node.

```
┌─────────┐     SSH/rsync     ┌─────────┐
│ Primary │ ←────────────────► │ Remote  │
│ bridge  │                   │ bridge  │
└────┬────┘                   └────┬────┘
     │ Supabase sync               │ Supabase sync
     └──────────┬──────────────────┘
                ▼
           Supabase
                │
           Dashboard
```

## Prerequisites

- Two or more VPS instances, each with Node.js 20+, Git, and Claude Code CLI installed
- SSH key-based access from the primary node to all remote nodes
- A configured Supabase project (required for multi-VPS — offline mode is single-node only)

## Step 1 — Install the Bridge on Each Node

On the **primary** node (if not already installed):

```bash
git clone https://github.com/YOUR_ORG/agent-mission-control
cd agent-mission-control/bridge
./install.sh /path/to/your/repo
```

On each **remote** node:

```bash
git clone https://github.com/YOUR_ORG/agent-mission-control
cd agent-mission-control/bridge
./install.sh /path/to/your/repo
```

## Step 2 — Configure Supabase on Every Node

Edit `~/.agent-mc/config.json` on **each** node:

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anon_key": "your-anon-key",
    "enabled": true
  }
}
```

All nodes must point to the **same** Supabase project. Each node's bridge authenticates with its own service account.

## Step 3 — Register Nodes in Supabase

In the Supabase dashboard (or via `psql`), insert a row into `vps_nodes` for each node:

```sql
INSERT INTO vps_nodes (id, name, hostname, status, max_agents)
VALUES
  ('primary',  'Primary VPS',    'primary.example.com',  'active', 5),
  ('remote-1', 'Remote VPS EU',  'eu-1.example.com',     'active', 3),
  ('remote-2', 'Remote VPS US',  'us-1.example.com',     'active', 3);
```

Update the `node_id` in each node's `config.json`:

```json
{
  "node_id": "primary"
}
```

## Step 4 — Configure Worktree Sync

On each remote node, choose a sync mode in `config.json`:

### Mode A — `shared_remote` (Git push/pull)

Both nodes work in git branches. State is transferred via git push:

```json
{
  "worktree_sync": {
    "mode": "shared_remote",
    "remote": "origin",
    "branch_prefix": "agent/"
  }
}
```

### Mode B — `rsync` (Direct file transfer)

Files are synced via SSH rsync from remote to primary:

```json
{
  "worktree_sync": {
    "mode": "rsync",
    "target_host": "primary.example.com",
    "target_user": "gregmorris",
    "target_path": "/home/gregmorris/.agent-mc/worktrees/",
    "ssh_key": "~/.ssh/id_ed25519"
  }
}
```

## Step 5 — Start All Bridge Instances

On each node:

```bash
# Option A — systemd (recommended)
sudo systemctl start agent-bridge

# Option B — PM2
pm2 start pm2.config.js

# Option C — foreground (testing)
cd bridge && npm start
```

## Step 6 — Verify in the Dashboard

Open the dashboard. In the **VPS Nodes** panel you should see all registered nodes with their status:

- Green dot — bridge running, heartbeat recent
- Yellow dot — bridge healthy but no active agents
- Red dot — bridge missed last heartbeat (> 30s)

Agents spawned on any node will appear in the agent cards with a node badge (`[eu-1]`, `[us-1]`).

## Spawning Agents on a Specific Node

Include `vps_node_id` in the spawn command payload:

```json
{
  "type": "spawn_agent",
  "payload": {
    "session_id": "my-session",
    "agent_key": "backend-eu",
    "vps_node_id": "remote-1",
    "role": "backend",
    "prompt": "Implement the payment processing module"
  }
}
```

The primary bridge forwards the command to the specified node via SSH.

## Cost Aggregation

With Supabase enabled, costs from all nodes are aggregated into the **Costs** view in the dashboard. Per-node breakdown is shown in the VPS panel.

## Troubleshooting

**Remote node shows as offline:**
- SSH to the remote node and check: `sudo systemctl status agent-bridge`
- Verify the Supabase credentials in the remote `config.json`
- Check the Supabase `vps_nodes` table — the row's `status` field is updated by the bridge

**Commands sent to remote node not executing:**
- Check SSH key is loaded: `ssh -T user@remote.example.com`
- Check SSH key path in `config.json` on the primary node
- Review primary bridge audit log: `tail -f ~/.agent-mc/logs/audit_$(date +%Y-%m-%d).jsonl | jq .`
