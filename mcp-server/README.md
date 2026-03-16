# Agent Mission Control — MCP Server

Bidirectional communication between Claude Code agent sessions and the Agent Mission Control dashboard.

## What it does

Agents use these tools to proactively:
- Report status (task, context usage, stage)
- Log token costs and check budget limits
- Read/update the Kanban task board
- Request human approval for risky operations (blocking on red-level)
- Write to the audit trail
- Send messages to other agents

## Install

```bash
cd mcp-server
npm install
npm run build
```

## Configure Claude Code

Copy `.mcp.json.example` to your project root as `.mcp.json`:

```json
{
  "mcpServers": {
    "agent-mission-control": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AGENT_MC_AGENT_KEY": "backend",
        "AGENT_MC_SESSION_ID": "your-session-id",
        "AGENT_MC_STATE_DIR": "~/.agent-mc",
        "AGENT_MC_BUDGET_CENTS": "500"
      }
    }
  }
}
```

The bridge sets these env vars automatically when spawning agents.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_MC_AGENT_KEY` | No | Agent identifier (default: `default`) |
| `AGENT_MC_SESSION_ID` | No | Session UUID (default: `local`) |
| `AGENT_MC_STATE_DIR` | No | State directory (default: `~/.agent-mc`) |
| `AGENT_MC_BUDGET_CENTS` | No | Budget limit in USD cents, `0` = unlimited |

## Filesystem Layout

```
~/.agent-mc/
├── state/
│   ├── agents/
│   │   ├── <agent-key>.json        # Agent status (atomic write)
│   │   └── <agent-key>.cost.json   # Cumulative cost
│   ├── tasks.json                  # Kanban tasks
│   ├── approvals/
│   │   └── <id>.json               # Approval requests
│   └── inbox/
│       └── <agent-key>/
│           └── <msg-id>.json       # Messages (deleted after read)
└── logs/
    └── audit-<date>.jsonl          # Append-only audit log
```

## Tools (10 total)

### Status & Monitoring

| Tool | Description |
|------|-------------|
| `mc_report_status` | Report current status, task, context usage |
| `mc_report_cost` | Report token costs, get budget status |
| `mc_get_team_status` | Read all agents' current status |

### Task Management

| Tool | Description |
|------|-------------|
| `mc_get_tasks` | Read Kanban board, filter by column/agent/tag |
| `mc_update_task` | Move or assign tasks (state machine enforced) |

### Approvals

| Tool | Description |
|------|-------------|
| `mc_request_approval` | Request approval — green=auto, yellow=queue, red=BLOCK |
| `mc_check_approval` | Poll approval status by ID |

### Audit & Messaging

| Tool | Description |
|------|-------------|
| `mc_log_event` | Write structured event to JSONL audit log |
| `mc_send_message` | Send message to another agent's inbox |
| `mc_read_messages` | Read and clear own inbox |

## Approval Risk Levels

- 🟢 **green** — Auto-approved immediately (reads, non-destructive ops)
- 🟡 **yellow** — Queued in dashboard, agent continues without waiting
- 🔴 **red** — Agent BLOCKS until human approves or rejects (max 5 min timeout)

## Transport

stdio — runs as a child process of each Claude Code session. No network ports opened.

## Plugin System

The MCP server supports a lightweight plugin API that lets you add custom tools without modifying the core server.

### How it works

At startup the server reads all `*.plugin.js` files from the directory pointed to by the `PLUGIN_DIR` environment variable (default: `./plugins`). Each file must export a default object conforming to the `AgentPlugin` interface:

```ts
interface AgentPlugin {
  name: string;
  version: string;
  description: string;
  tools: PluginTool[];
}
```

Invalid or crashing plugins are skipped with a warning — they never crash the server.

### Environment variable

| Variable | Default | Description |
|----------|---------|-------------|
| `PLUGIN_DIR` | `./plugins` | Directory containing `*.plugin.js` plugin files |

### Writing a plugin

See `docs/site/docs/api/plugins.md` for the full guide and a "hello world" example.
