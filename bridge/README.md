# Agent Bridge

Hybrid orchestration bridge for Agent Mission Control. Sits between the dashboard and Claude Code agent sessions, translating commands into process spawns, monitoring health, and aggregating status.

**Zero network listeners.** All communication via filesystem IPC and optional Supabase sync.

## Quick Start

```bash
# Install and configure
./install.sh /path/to/your/repo

# Start the bridge
npm start
```

## How It Works

The bridge runs a 4-operation loop every 2 seconds:

1. **Health Check** — Verifies agent PIDs are alive, detects stale/crashed agents
2. **Command Processing** — Reads command files from `~/.agent-mc/commands/`, validates session tokens, executes
3. **Status Aggregation** — Reads Claude Code session data, writes `dashboard_state.json`
4. **Worktree Management** — Creates/cleans up git worktrees for agent isolation

## Directory Structure

```
~/.agent-mc/
├── commands/           # Dashboard → Bridge commands
│   ├── cmd_<uuid>.json
│   └── .processed/     # Processed commands archived here
├── state/              # Bridge → Dashboard state
│   ├── dashboard_state.json
│   ├── agents/         # Per-agent state files
│   └── heartbeat.json  # Bridge health indicator
├── logs/               # Append-only audit trail
│   └── audit_YYYY-MM-DD.jsonl
├── worktrees/          # Git worktrees per agent
├── config.json         # Bridge configuration
└── .session_token      # Auth token (auto-generated)
```

## Command Format

Write JSON files to `~/.agent-mc/commands/` named `cmd_<uuid>.json`:

```json
{
  "id": "unique-id",
  "type": "spawn_agent",
  "timestamp": "2026-03-12T10:00:00Z",
  "session_token": "<token from .session_token>",
  "payload": {
    "session_id": "my-session",
    "agent_key": "backend",
    "role": "backend",
    "prompt": "Implement the auth middleware"
  }
}
```

### Command Types

| Type | Payload | Description |
|------|---------|-------------|
| `spawn_agent` | `session_id`, `agent_key`, `role`, `prompt?`, `model?` | Spawn a new agent in a worktree |
| `terminate_agent` | `session_id`, `agent_key` | Gracefully stop an agent |
| `pause_agent` | `session_id`, `agent_key` | SIGSTOP an agent |
| `resume_agent` | `session_id`, `agent_key` | SIGCONT a paused agent |
| `approve_task` | `session_id`, `task_id`, `approved` | Approve/reject a task |
| `update_config` | — | Trigger config reload |

## Configuration

Edit `~/.agent-mc/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `repo_path` | — | **Required.** Path to the git repository |
| `loop_interval_ms` | 2000 | Main loop interval |
| `max_agents` | 5 | Maximum concurrent agents |
| `auto_restart_on_crash` | true | Restart crashed agents (max 3 attempts) |
| `supabase.enabled` | false | Enable Supabase sync for remote access |
| `supabase.url` | — | Supabase project URL |
| `supabase.anon_key` | — | Supabase anon/publishable key |
| `agent_defaults.model` | claude-sonnet-4-20250514 | Default model for agents |
| `agent_defaults.max_turns` | 50 | Default max conversation turns |
| `agent_roles` | See config | Per-role tool allowlists and directory scopes |
| `budget.session_limit_cents` | null | Session-wide budget cap |
| `budget.agent_limit_cents` | null | Per-agent budget cap |
| `worktreeSync.mode` | `none` | Worktree sync mode: `none`, `shared_remote`, or `rsync` |

### Worktree Sync

The bridge can optionally sync agent worktree state to a remote after each aggregation cycle. Set `worktreeSync.mode` in `config.json` to activate.

**Mode: `none` (default)**

No sync is performed. This is the correct setting for single-VPS deployments.

```json
{
  "worktreeSync": {
    "mode": "none"
  }
}
```

**Mode: `shared_remote`**

Each agent worktree pushes its HEAD to a dedicated branch on a shared remote: `refs/heads/agent/{agentKey}`. This lets multiple agents work concurrently, each on an isolated branch. A bridge lead (or CI job) can then aggregate branches with a merge step.

```json
{
  "worktreeSync": {
    "mode": "shared_remote",
    "shared_remote": {
      "remote": "origin",
      "baseBranch": "main"
    }
  }
}
```

| Key | Description |
|-----|-------------|
| `remote` | Git remote name to push to (e.g. `origin`) |
| `baseBranch` | Base branch name (informational — records intent for the merge step) |

Each push targets `refs/heads/agent/{agentKey}` on the configured remote.

**Mode: `rsync`**

Syncs the bridge state directory (`~/.agent-mc/state/`) to a remote VPS node over SSH using `rsync`. Useful for multi-VPS setups where the dashboard runs on a different machine from the bridge.

```json
{
  "worktreeSync": {
    "mode": "rsync",
    "rsync": {
      "remoteHost": "user@vps2.example.com",
      "remotePath": "/home/user/.agent-mc/state",
      "sshKey": "/home/user/.ssh/id_rsa"
    }
  }
}
```

| Key | Description |
|-----|-------------|
| `remoteHost` | SSH destination in `user@host` format |
| `remotePath` | Absolute path on the remote host to sync state into |
| `sshKey` | *(Optional)* Path to SSH private key. Omit if your default key is already configured |

Requires `rsync` and `ssh` to be installed and `remoteHost` to be reachable from the bridge machine. Sync failures are logged but do not halt the main loop.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need. The bridge reads env vars at runtime — no `.env` file is loaded automatically; use your shell, systemd `EnvironmentFile=`, or PM2 `env:` config to inject them.

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Only for `decompose_objective` | Powers the task decomposition engine. The bridge runs without it — the command logs a warning and returns an empty result if the key is absent. |

## Security

- **Session token**: Auto-generated on first run. Every command must include this token.
- **Tool allowlisting**: Each agent role gets explicit tool permissions enforced at spawn.
- **Directory scoping**: Agents work in isolated git worktrees with `--project-dir`.
- **Audit logging**: Every command, spawn, termination, and state change is logged.
- **No network listeners**: Bridge never opens ports. Filesystem IPC only.

## Supabase Sync

When enabled, the bridge pushes agent state to Supabase tables (`agents`, `agent_sessions`) each loop cycle. This allows the web dashboard to show real-time data from anywhere.

Set in `config.json`:
```json
{
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "your-key-here",
    "enabled": true
  }
}
```

The bridge works fully offline without Supabase — filesystem IPC is always the primary channel.

## Running in Production

For long-running deployments you should run the bridge as a managed service so it restarts automatically on crash or reboot.

### Option A — systemd (recommended on Ubuntu/Debian/RHEL)

A unit file is included at `bridge/agent-bridge.service`.

```bash
# Copy to systemd and enable
sudo cp agent-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agent-bridge    # start on boot
sudo systemctl start agent-bridge

# Check status / logs
sudo systemctl status agent-bridge
sudo journalctl -u agent-bridge -f
```

The unit runs as `User=gregmorris`. If you deploy under a different user, edit the `User=` and `WorkingDirectory=` lines before copying.

### Option B — PM2

A PM2 ecosystem config is included at `bridge/pm2.config.js`.

```bash
# Install PM2 globally (once)
npm install -g pm2

# Start the bridge
pm2 start pm2.config.js

# Persist across reboots
pm2 save
pm2 startup   # follow the printed command

# Monitor
pm2 status
pm2 logs agent-bridge
```

PM2 logs are written to `~/.agent-mc/logs/pm2-out.log` and `pm2-err.log` by default. Adjust the `out_file` / `error_file` paths in `pm2.config.js` if your data directory differs.
