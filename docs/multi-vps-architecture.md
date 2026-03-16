# Multi-VPS Architecture

Agent Mission Control supports running Claude Code agents across multiple VPS nodes, with all state aggregated into a single dashboard view.

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PRIMARY VPS                              │
│  bridge/ daemon — orchestrates agents, syncs to Supabase    │
│  - Reads VPS registry (vps-registry.json)                   │
│  - Polls heartbeat from each registered VPS via SSH         │
│  - rsync pulls agent state from remote VPS nodes            │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSH + rsync (outbound only)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    REMOTE VPS (N nodes)                      │
│  bridge-remote/ daemon — monitors local agents               │
│  - Writes heartbeat.json and agent_state.json atomically     │
│  - Primary bridge rsync-pulls these files every loop cycle  │
│  - NO inbound TCP — remote bridge never listens             │
└─────────────────────────────────────────────────────────────┘
                       │ Supabase push (from primary bridge)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                                │
│  vps_nodes table — aggregated heartbeat + agent metrics     │
│  agents table — agent state from all nodes                   │
│  events table — context alerts, errors, stage changes       │
└─────────────────────────────────────────────────────────────┘
                       │ Realtime subscription
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD (app/)                          │
│  VPSManager — lists all nodes with heartbeat status badges  │
│  AgentView — agents from all sessions/nodes                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Invariants

### Worktree Ownership
- **Only the primary bridge** creates and deletes git worktrees.
- Remote VPS nodes do NOT manage worktrees. They only run agent processes against directories that have been rsynced to them from the primary.
- A worktree is always owned by exactly one VPS node at a time.
- Concurrent writes to the same git worktree from multiple nodes are not allowed.

### Data Flow Direction
- State always flows: **remote VPS → primary bridge → Supabase → dashboard**
- Commands always flow: **dashboard → Supabase → primary bridge → (SSH) → remote VPS**
- There is no direct dashboard → remote VPS communication path.

### Zero Inbound Network
- Neither `bridge/` nor `bridge-remote/` opens any TCP/UDP port.
- All communication is outbound-only (rsync, SSH) from the primary bridge to remote nodes.
- The primary bridge's main loop polls remote nodes — remote nodes never initiate connections.

---

## VPS Registration

### Step 1: Register in the dashboard

Open the dashboard VPS panel and click **+ Register**. Provide:
- **Label** — human-readable name (`prod-vps-1`)
- **Host** — IP address or hostname
- **Region** — optional, for display purposes
- **Max agents** — capacity ceiling for the node

This creates a record in the Supabase `vps_nodes` table.

### Step 2: Register SSH config in the bridge

On the primary VPS, the bridge needs the SSH credentials to reach the remote node. This is stored in `~/.agent-mc/state/vps-registry.json` and managed via the `vpsRegistry` module in `bridge/src/vps/`. The bridge admin registers VPS nodes with SSH key, user, and port via the registry API (CLI tooling TBD — see backlog M4-005).

### Step 3: Deploy bridge-remote

```bash
./scripts/deploy-bridge-remote.sh <vps-host> <vps-user> <ssh-key-path> [node-id] [node-label]
```

Example:
```bash
./scripts/deploy-bridge-remote.sh 192.168.1.10 ubuntu ~/.ssh/id_ed25519 prod-vps-1 "Production VPS"
```

The script:
1. Builds `bridge-remote/` locally (`npm run build`)
2. rsyncs the built package to the remote VPS
3. Installs production dependencies on the remote
4. Initializes `bridge-remote` config (if first deploy)
5. Starts `bridge-remote` in the background
6. Validates the heartbeat file was written

---

## Heartbeat Monitoring

The primary bridge's `heartbeatMonitor` polls each registered VPS every 60 seconds by running `uptime` via SSH. Results are:
- Cached in memory (`getHeartbeatResults()`)
- Written to the audit log
- Pushed to Supabase `vps_nodes` table (planned — currently logged only)

The dashboard's `VPSManager` shows each node's health badge: `healthy`, `degraded`, or `offline`.

A single VPS becoming unreachable does **not** crash the primary bridge. The error is logged and the next heartbeat cycle retries automatically.

---

## rsync State Sync

The primary bridge pulls state from remote nodes via rsync:

```
rsync -avz -e 'ssh -i <key>' user@host:~/.agent-mc-remote/state/ <local-state-dir>/
```

Files synced:
- `heartbeat.json` — node liveness + uptime
- `agent_state.json` — agent process list, context usage, costs

The primary bridge reads these files during its main loop and incorporates remote agents into the aggregated `dashboard_state.json` and Supabase sync.

### Atomicity Guarantee

`bridge-remote` always writes to `<file>.tmp` then renames to `<file>.json`. This ensures the primary bridge (reading via rsync) never sees a partial file. rsync uses atomic rename semantics at the destination — it writes to a temp file and renames on completion.

---

## SSH Security

The SSH wrapper (`bridge/src/vps/sshWrapper.ts`) enforces:
- **Allowlisted commands only**: `uptime`, `df`, `free`, `ps`, `systemctl`, `journalctl`, `cat`
- **Per-command argument patterns**: arguments are validated against a per-command regex allowlist before execution
- **No shell injection**: `child_process.spawn` is used (never `exec`), arguments are passed as array elements
- **Path traversal prevention**: `..` is rejected in all path arguments
- **Sensitive path blocking**: `/etc/shadow`, `/etc/passwd`, `/.ssh` blocked for `cat`
- **BatchMode=yes**: SSH never prompts for passwords; fails fast if key auth fails

---

## Load Balancing (M4-007, deferred)

When multiple VPS nodes are registered, the primary bridge will select the node with the lowest agent load (agentCount / agentCapacity) for new agent spawns. This is tracked in `vps-registry.json` and updated after each spawn.

Implementation deferred to a follow-up milestone — the foundation (registry, heartbeat, SSH wrapper) is in place.

---

## Troubleshooting

**Bridge-remote not starting after deploy:**
```bash
ssh user@host 'cat ~/.agent-mc-remote/logs/bridge.log'
```

**Check heartbeat manually:**
```bash
ssh user@host 'cat ~/.agent-mc-remote/state/heartbeat.json'
```

**Manually rsync state from remote:**
```bash
rsync -avz -e 'ssh -i <key>' user@host:~/.agent-mc-remote/state/ ./remote-state/
```

**Primary bridge heartbeat log:**
```bash
grep '"event":"heartbeat"' ~/.agent-mc/logs/audit_$(date +%Y-%m-%d).jsonl
```
