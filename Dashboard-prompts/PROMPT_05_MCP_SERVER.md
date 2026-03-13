# PROMPT 05: MCP Server Integration

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first. Bridge from Prompt 02 defines the state directory structure.
> **Skill reference:** Read `/mnt/skills/examples/mcp-builder/SKILL.md` before starting.
> **Deliverables:** Complete `mcp-server/` project
> **Estimated effort:** 1 Claude Code session

---

## Objective

Build an MCP (Model Context Protocol) server that enables Claude Code agent sessions to communicate bidirectionally with Agent Mission Control. Agents can report status, request approvals, query the task board, and message each other.

## Why MCP

Currently the bridge polls Claude Code's state. With MCP, agents proactively:
- Report status (not just polled)
- Request human approval for risky operations
- Read/update Kanban board
- Query other agents' work (avoid conflicts)
- Report cost per tool call

## Transport

**stdio** — MCP server runs as child process of each Claude Code session. Configured via `.mcp.json` in project root.

## Tools (10 total)

### Status & Monitoring

1. **`mc_report_status`** — Agent reports its current state
   - Input: `{ status, task, context_pct, files? }`
   - Writes to `~/.agent-mc/state/agents/<agent_key>.json`
   - Returns: acknowledgment + pending commands

2. **`mc_report_cost`** — Agent reports token/cost usage
   - Input: `{ input_tokens, output_tokens, cost_cents }`
   - Checks budget, returns `{ total_cost_cents, budget_remaining_cents, budget_status }`

3. **`mc_get_team_status`** — Query all agents' status
   - Input: `{ session_id? }`
   - Returns: array of agent statuses

### Task Management

4. **`mc_get_tasks`** — Read Kanban tasks
   - Input: `{ column?, assigned_to?, tag? }`
   - Returns: filtered task list

5. **`mc_update_task`** — Move/assign tasks
   - Input: `{ task_id, column?, assigned_agent?, recommendation? }`
   - Returns: updated task

6. **`mc_request_approval`** — Request permission for action
   - Input: `{ action, risk_level: 'green'|'yellow'|'red', details, files_affected? }`
   - Green: auto-approves. Yellow: queues, continues. Red: blocks until human decides.
   - Returns: `{ approved, wait }`

7. **`mc_check_approval`** — Check approval status
   - Input: `{ request_id }`
   - Returns: `{ status: 'pending'|'approved'|'rejected', reason? }`

### Audit & Communication

8. **`mc_log_event`** — Write to audit trail
   - Input: `{ type, description, file?, metadata? }`
   - Returns: event ID

9. **`mc_send_message`** — Message another agent
   - Input: `{ to_agent, message }`
   - Writes to target agent's inbox file

10. **`mc_read_messages`** — Read inbox
    - Input: `{}`
    - Returns: messages, clears inbox

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts           # Server setup + tool registration
│   ├── tools/
│   │   ├── status.ts      # mc_report_status, mc_report_cost, mc_get_team_status
│   │   ├── tasks.ts       # mc_get_tasks, mc_update_task
│   │   ├── approvals.ts   # mc_request_approval, mc_check_approval
│   │   ├── events.ts      # mc_log_event
│   │   └── messaging.ts   # mc_send_message, mc_read_messages
│   ├── state/
│   │   ├── reader.ts      # Read state from filesystem
│   │   └── writer.ts      # Write state updates
│   └── config.ts          # Agent key, session ID from env vars
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

Environment variables set by bridge when spawning:
```
AGENT_MC_AGENT_KEY=backend
AGENT_MC_SESSION_ID=uuid
AGENT_MC_STATE_DIR=~/.agent-mc
```

Integration with Claude Code (`.mcp.json`):
```json
{
  "mcpServers": {
    "agent-mission-control": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AGENT_MC_AGENT_KEY": "backend",
        "AGENT_MC_SESSION_ID": "session-uuid",
        "AGENT_MC_STATE_DIR": "~/.agent-mc"
      }
    }
  }
}
```

## Tool Annotations

```
mc_report_status:    { readOnlyHint: false, destructiveHint: false }
mc_report_cost:      { readOnlyHint: false, destructiveHint: false }
mc_get_team_status:  { readOnlyHint: true }
mc_get_tasks:        { readOnlyHint: true }
mc_update_task:      { readOnlyHint: false, destructiveHint: false }
mc_request_approval: { readOnlyHint: false, destructiveHint: false }
mc_check_approval:   { readOnlyHint: true }
mc_log_event:        { readOnlyHint: false, destructiveHint: false }
mc_send_message:     { readOnlyHint: false, destructiveHint: false }
mc_read_messages:    { readOnlyHint: false, destructiveHint: false }
```

## Deliverables

1. Complete `mcp-server/` project
2. All 10 tools with Zod schemas
3. `package.json` with MCP SDK
4. `README.md` with setup + Claude Code integration
5. Example `.mcp.json`

## Acceptance Criteria

- [ ] MCP server starts via stdio transport
- [ ] All 10 tools register and respond
- [ ] Status reporting writes correct state files
- [ ] Cost tracking checks budgets
- [ ] Red-level approvals block until human decides
- [ ] Inter-agent messaging via filesystem inbox
- [ ] Audit events append to JSONL log
- [ ] Works with Claude Code MCP configuration
