# PROMPT 02: Hybrid Bridge Script

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first for full project context.
> **Deliverables:** Complete `bridge/` project directory
> **Estimated effort:** 1 Claude Code session

---

## Objective

Build a thin orchestration bridge (`agent-bridge`) that sits between the dashboard and Claude Code agent sessions. It translates dashboard commands into Claude Code session spawns, monitors agent health, and aggregates status data.

**Critical security constraint:** NO network listeners. No TCP sockets, no WebSocket servers, no HTTP endpoints. All communication is via filesystem-based IPC (JSON files) and optional Supabase sync.

## Architecture

```
Dashboard (browser) 
    ↕ Supabase Realtime (primary) OR reads/writes JSON files (fallback)
Bridge Script (runs on VPS)
    ↕ spawns/monitors processes
Claude Code Sessions (agent processes)
```

### Communication: Filesystem IPC

```
~/.agent-mc/
├── commands/           # Dashboard writes commands here (via Supabase sync or direct)
│   ├── cmd_<uuid>.json
│   └── .processed/     # Processed commands moved here
├── state/              # Bridge writes state here
│   ├── dashboard_state.json  # Aggregated state for dashboard
│   ├── agents/               # Per-agent state files
│   │   ├── lead.json
│   │   └── backend.json
│   └── heartbeat.json        # Bridge health indicator
├── logs/               # Append-only audit trail
│   └── audit_<date>.jsonl
├── worktrees/          # Managed git worktrees
├── config.json         # Bridge configuration
└── .session_token      # Auth token (generated on first run)
```

### Command Schema

```json
{
  "id": "uuid",
  "type": "spawn_agent|terminate_agent|approve_task|update_config|pause_agent|resume_agent",
  "timestamp": "ISO8601",
  "session_token": "token-for-validation",
  "payload": {}
}
```

### Bridge Loop (4 operations, every 2 seconds)

1. **Health Check** — PID liveness, last output timestamp, mark dead agents as 'error'
2. **Command Processing** — Read new command files, validate token, execute, move to `.processed/`
3. **Status Aggregation** — Read Claude Code session data (`~/.claude/tasks/`), write aggregated state
4. **Worktree Management** — Create/cleanup git worktrees, environment bootstrapping

## Tech Stack

- **Language:** Node.js (TypeScript)
- **Dependencies (minimal):** `chokidar` (file watching), `execa` (process management), `zod` (schema validation)
- **No web frameworks.** No express, no fastify, nothing with a listener.

## Project Structure

```
bridge/
├── src/
│   ├── index.ts              # Main loop + CLI entry
│   ├── config.ts             # Configuration management
│   ├── commands/
│   │   ├── processor.ts      # Command file reader & validator
│   │   ├── spawn.ts          # Agent spawn logic
│   │   ├── terminate.ts      # Agent termination
│   │   └── approve.ts        # Task approval handler
│   ├── health/
│   │   ├── checker.ts        # PID liveness, output staleness
│   │   └── recovery.ts       # Auto-restart logic
│   ├── state/
│   │   ├── aggregator.ts     # Collect agent state from all sources
│   │   ├── writer.ts         # Write dashboard_state.json
│   │   └── claude-reader.ts  # Parse Claude Code session/task data
│   ├── worktree/
│   │   ├── manager.ts        # Git worktree create/cleanup
│   │   └── bootstrap.ts      # Copy .env, run npm install, etc.
│   ├── supabase/
│   │   ├── sync.ts           # Push state to Supabase, pull commands
│   │   └── client.ts         # Supabase client setup
│   ├── audit/
│   │   └── logger.ts         # Append-only JSONL audit log
│   └── security/
│       ├── token.ts          # Session token generation & validation
│       └── permissions.ts    # Tool allowlist enforcement
├── package.json
├── tsconfig.json
├── install.sh                # One-command setup script
└── README.md
```

## Security Requirements

1. **Session token:** First run generates random token → `~/.agent-mc/.session_token`. Every command must include this token. Prevents rogue processes from injecting commands.

2. **No credential storage:** Bridge never stores API keys. Claude Code agents inherit from environment. Bridge passes through env vars selectively.

3. **Tool allowlisting:** Each agent role has explicit tool allowlist. Bridge passes `--allowedTools` when spawning.

4. **Directory scoping:** Git worktree IS the filesystem boundary. Bridge sets `--project-dir`.

5. **Audit logging:** Every command, process spawn, status change → append-only JSONL.

## Agent Spawning

```typescript
async function spawnAgent(config: AgentConfig): Promise<void> {
  // 1. Create git worktree
  const worktreePath = await createWorktree(config.sessionId, config.agentKey);
  
  // 2. Bootstrap environment
  await bootstrapEnvironment(worktreePath, config.envVars);
  
  // 3. Spawn Claude Code in headless mode
  const proc = spawn('claude', [
    '--headless',
    '--project-dir', worktreePath,
    '--allowedTools', config.toolAllowlist.join(','),
    '--model', config.model || 'claude-sonnet-4-20250514',
    '--max-turns', String(config.maxTurns || 50),
  ], {
    env: filterEnv(config.envFilter),
    cwd: worktreePath,
  });
  
  // 4. Record PID
  await recordAgentPID(config.sessionId, config.agentKey, proc.pid);
  
  // 5. Audit log
  await audit('spawn', { sessionId: config.sessionId, agent: config.agentKey, pid: proc.pid });
}
```

## Supabase Sync (Optional)

When configured in `config.json`:
- Push state updates to Supabase `agents` + `agent_sessions` tables each loop
- Pull new commands from Supabase (for remote dashboard access)
- Post heartbeat to `vps_nodes` table every 30s
- Supabase project: `zpsnbogldtepmfwgqarz`

Works fully offline without Supabase — filesystem IPC is always the primary channel.

## Configuration

`~/.agent-mc/config.json`:

```json
{
  "loop_interval_ms": 2000,
  "repo_path": "/path/to/main/repo",
  "max_agents": 5,
  "auto_restart_on_crash": true,
  "worktree_bootstrap": {
    "copy_files": [".env", ".env.local"],
    "run_commands": ["npm install --silent"]
  },
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "",
    "enabled": false
  },
  "agent_defaults": {
    "model": "claude-sonnet-4-20250514",
    "max_turns": 50,
    "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
  },
  "agent_roles": {
    "lead": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Task", "SendMessage"],
      "directory_scope": ["/"]
    },
    "backend": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "directory_scope": ["/app", "/database", "/routes", "/tests"]
    },
    "frontend": {
      "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "directory_scope": ["/src", "/public", "/components", "/tests"]
    },
    "reviewer": {
      "tool_allowlist": ["Read", "Grep", "Glob"],
      "directory_scope": ["/"]
    }
  },
  "budget": {
    "session_limit_cents": null,
    "agent_limit_cents": null,
    "alert_threshold_pct": 80
  }
}
```

## Deliverables

1. Complete `bridge/` project with all source files
2. `package.json` with minimal dependencies
3. `tsconfig.json` for Node.js
4. `install.sh` — one-command setup (creates dirs, installs deps, generates token)
5. `README.md` with installation, configuration, usage

## Acceptance Criteria

- [ ] Runs as foreground process, clean exit on SIGINT/SIGTERM
- [ ] Zero network listeners
- [ ] Session token validation on all commands
- [ ] Agents spawn in isolated git worktrees
- [ ] Health check detects crashed agents within 2 loop iterations (4 seconds)
- [ ] Status aggregation produces valid `dashboard_state.json`
- [ ] Audit log captures every command and state change
- [ ] Tool allowlisting per agent role enforced at spawn
- [ ] Works fully offline (no Supabase required)
- [ ] Optional Supabase sync for remote access
- [ ] Under 2000 lines of TypeScript total
