# agent-bridge-remote

Lightweight daemon for remote VPS nodes in an Agent Mission Control multi-VPS setup.

Mirrors the primary bridge's constraints: zero network listeners, filesystem IPC only, atomic writes, append-only audit logs.

## Prerequisites

- Node.js >= 20.0.0
- npm
- SSH access from the primary bridge to this VPS

## Deploy via script (recommended)

From the primary bridge server:

```bash
./scripts/deploy-bridge-remote.sh <vps-host> <vps-user> <ssh-key> [node-id] [node-label]
```

## Manual deploy

```bash
# On the primary machine — build and sync
npm run build
rsync -avz --exclude node_modules --exclude .git . user@host:~/agent-mc-remote/

# On the remote VPS
cd ~/agent-mc-remote
npm install --omit=dev

# Initialize config (first time only)
node dist/index.js --init my-node-id "My Node Label"

# Edit config
nano ~/.agent-mc-remote/config.json

# Start
nohup node dist/index.js >> ~/.agent-mc-remote/logs/bridge.log 2>&1 &
```

## Config (`~/.agent-mc-remote/config.json`)

```json
{
  "node_id": "prod-vps-1",
  "node_label": "Production VPS",
  "loop_interval_ms": 5000,
  "monitored_agents": []
}
```

| Field | Description |
|-------|-------------|
| `node_id` | Unique identifier matching the VPS registry on the primary bridge |
| `node_label` | Human-readable display name |
| `loop_interval_ms` | State write interval (default: 5000ms) |
| `monitored_agents` | Agent keys this node monitors (empty = all local agents) |

## State files (read by primary bridge via rsync)

| File | Description |
|------|-------------|
| `~/.agent-mc-remote/state/heartbeat.json` | Node liveness + uptime |
| `~/.agent-mc-remote/state/agent_state.json` | Agent process list, context usage, costs |

## Logs

```bash
tail -f ~/.agent-mc-remote/logs/bridge.log
tail -f ~/.agent-mc-remote/logs/audit_$(date +%Y-%m-%d).jsonl
```

## Architecture notes

- **No inbound TCP** — bridge-remote never opens a port. The primary bridge SSH-polls and rsync-pulls.
- **Atomic writes** — all state files are written to `.tmp` then renamed.
- **Audit logs** — append-only JSONL, never truncated or deleted.
- Worktrees are owned and managed by the primary bridge only.
