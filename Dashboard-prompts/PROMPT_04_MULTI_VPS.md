# PROMPT 04: Multi-VPS Orchestration

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first. Bridge from Prompt 02 is built.
> **Deliverables:** Updated `bridge/` + new `bridge-remote/` project
> **Estimated effort:** 1-2 Claude Code sessions

---

## Objective

Extend the Hybrid Bridge to orchestrate agent sessions across multiple remote VPS instances via SSH. The primary bridge runs on one VPS and coordinates agents on additional nodes.

## Architecture

```
Primary VPS (Bridge Host)
├── agent-bridge (main loop)
├── Local agents (spawned directly)
└── SSH connections to remote VPS nodes
    ├── Remote VPS 1 → agent-bridge-remote (lightweight)
    └── Remote VPS 2 → agent-bridge-remote (lightweight)
```

### Remote Bridge (`agent-bridge-remote`)

Lightweight bridge that runs on each remote VPS:
- Accepts commands from primary bridge via SSH-forwarded filesystem writes
- Spawns and monitors local Claude Code agents
- Writes state to local `~/.agent-mc/state/`
- Primary bridge reads remote state via `rsync` or `scp`

### Communication: SSH Only

All inter-VPS communication via SSH. No additional ports.

```typescript
// State sync
await exec(`rsync -az ${vps.user}@${vps.hostname}:~/.agent-mc/state/ ~/.agent-mc/remote/${vps.id}/state/`);

// Send command
await exec(`ssh ${vps.user}@${vps.hostname} 'cat > ~/.agent-mc/commands/cmd_${cmd.id}.json' << 'EOF'\n${JSON.stringify(cmd)}\nEOF`);
```

### VPS Registration Flow

1. `agent-bridge setup-remote` interactive CLI
2. Prompts: hostname, SSH user, key path
3. Tests SSH, verifies fingerprint
4. Deploys `agent-bridge-remote` via `scp`
5. Starts remote bridge via `ssh ... nohup agent-bridge-remote &`
6. Registers in Supabase `vps_nodes` table (if configured)

### Heartbeat Protocol

Remote bridges write `heartbeat.json` every 10 seconds:

```json
{
  "vps_id": "uuid",
  "timestamp": "ISO8601",
  "system": {
    "cpu_pct": 34.2,
    "ram_used_gb": 6.1,
    "ram_total_gb": 16,
    "disk_used_gb": 42,
    "disk_total_gb": 100
  },
  "agents": { "active": 3, "max": 5 }
}
```

Offline detection: no heartbeat in 60 seconds → status = 'offline'.

### Load Balancing

Agent spawn selects VPS with: status='online', capacity available, lowest current count.
Override: user can pin session to specific VPS.

### Git Worktree Sync

Two strategies (configurable):
1. **shared_remote** — all VPS nodes clone from same git remote
2. **rsync** — primary VPS rsyncs repo to remotes before spawning

## New Source Files

Add to `bridge/src/`:
```
├── remote/
│   ├── ssh.ts           # SSH command wrapper
│   ├── sync.ts          # rsync state sync
│   ├── deploy.ts        # Deploy bridge-remote to new VPS
│   ├── heartbeat.ts     # Heartbeat monitoring
│   └── load-balancer.ts # VPS selection
```

New `bridge-remote/` project:
```
bridge-remote/
├── src/
│   ├── index.ts         # Main loop (health + commands + state)
│   ├── health.ts
│   ├── commands.ts
│   ├── state.ts
│   └── heartbeat.ts
├── package.json
└── install.sh
```

## Deliverables

1. Updated `bridge/` with multi-VPS modules
2. Complete `bridge-remote/` project
3. `setup-remote` CLI command
4. Updated README with multi-VPS setup guide

## Acceptance Criteria

- [ ] Remote VPS registration via interactive CLI
- [ ] Agent spawning on remote VPS via SSH
- [ ] State sync via rsync (< 2 second latency)
- [ ] Heartbeat monitoring with offline detection
- [ ] Load balancing across VPS nodes
- [ ] All inter-VPS communication via SSH only
- [ ] Remote bridge installs with one command
- [ ] Audit trail includes which VPS each action occurred on
