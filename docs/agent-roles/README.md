# Agent Role Templates

This directory contains community-maintained role templates for the Agent Mission Control bridge.

Each JSON file defines an agent role that can be added to the `agent_roles` section of your `~/.agent-mc/config.json`.

## Schema

Each template follows the bridge's `agent_roles` schema:

```json
{
  "tool_allowlist": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  "directory_scope": ["/src", "/tests"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tool_allowlist` | `string[]` | Claude Code tools the agent is permitted to use |
| `directory_scope` | `string[]` | Directories the agent is restricted to within the worktree |

Some templates also include optional override fields:

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string` | Override the default model for this role |
| `max_turns` | `number` | Override the default maximum turns for this role |

## Available Templates

| File | Description |
|------|-------------|
| `backend-engineer.json` | Full read/write access to server-side directories |
| `frontend-engineer.json` | Full read/write access to UI and component directories |
| `code-reviewer.json` | Read-only access to the whole repo; uses claude-opus-4-6, capped at 20 turns |
| `devops.json` | Full read/write access to infra, scripts, and CI directories |

## How to Use

1. Open your `~/.agent-mc/config.json`.
2. Copy the contents of the desired template into the `agent_roles` object, using the role name as the key.

**Example — adding the `code-reviewer` role:**

```json
{
  "repo_path": "/path/to/your/repo",
  "agent_roles": {
    "code-reviewer": {
      "tool_allowlist": ["Read", "Grep", "Glob"],
      "directory_scope": ["/"]
    }
  }
}
```

3. Save `config.json` and restart the bridge — no rebuild required.

When spawning an agent via the dashboard or a `spawn` command, set the `role` field to the key you used (e.g. `"role": "code-reviewer"`). The bridge will apply the tool allowlist and directory scope automatically.

## Contributing

To add a new community template:
1. Create a JSON file following the schema above.
2. Add a row to the table in this README.
3. Open a pull request — templates are reviewed for security (no `Bash` in read-only roles, scoped `directory_scope` where appropriate).
