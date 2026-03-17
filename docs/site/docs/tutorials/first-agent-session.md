---
id: first-agent-session
title: Your First Agent Session
sidebar_position: 1
---

# Your First Agent Session

This tutorial walks you through spawning your first Claude Code agent with Agent Mission Control and watching it complete a coding task in real time.

## Prerequisites

Before starting, complete the [Getting Started](../getting-started) guide:

- Bridge is installed and running (`npm start` in `bridge/`)
- Dashboard is open in your browser
- Session token is saved (check `~/.agent-mc/.session_token`)

## Step 1 — Open a Session

The dashboard groups agents into **sessions** (one per feature branch or task).

1. Click **Add Session** in the topbar (or press `N` if you're on the React app).
2. Give the session a name — e.g. `feat/add-login-page`.
3. The session appears in the session selector.

## Step 2 — Write a Spawn Command

The dashboard sends commands to the bridge by writing JSON files to `~/.agent-mc/commands/`. The **Spawn Agent** form in the dashboard generates this for you, or you can write it directly:

```bash
# Read your session token
TOKEN=$(cat ~/.agent-mc/.session_token)

# Write a spawn command
cat > ~/.agent-mc/commands/cmd_$(date +%s)_spawn.json <<EOF
{
  "id": "$(uuidgen)",
  "type": "spawn_agent",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "session_token": "$TOKEN",
  "payload": {
    "session_id": "feat/add-login-page",
    "agent_key": "backend-1",
    "role": "backend",
    "prompt": "Add a login page component to src/components/auth/LoginPage.tsx with email + password form fields and a submit button.",
    "model": "claude-sonnet-4-6"
  }
}
EOF
```

## Step 3 — Watch the Agent Work

Within 2 seconds (one bridge loop), the agent card appears in the dashboard:

- **Status badge** changes: `idle` → `running`
- **Build stage** advances as the agent reads files, edits code, runs tests
- **Context bar** fills as the agent uses its context window
- **Cost counter** ticks up in real time (if Supabase sync is enabled)

The **Activity Stream** shows every tool call the agent makes — file reads, edits, bash commands.

## Step 4 — Approve or Intervene

If the agent hits a step that requires human approval (e.g. a `delete` or `force push`), it pauses and adds a card to the **Approvals** tab.

To approve:
1. Switch to the **Approvals** tab.
2. Review the proposed action.
3. Click **Approve** (or press `A`).

To reject (and stop the agent):
1. Click **Reject**.
2. The agent receives a termination signal and cleans up.

## Step 5 — Review the Output

When the agent completes, its status changes to `complete`. To review its work:

```bash
# See what files changed in the worktree
cd ~/.agent-mc/worktrees/feat-add-login-page-backend-1
git diff main
```

Or use the **Diff Viewer** in the React dashboard to see changes side-by-side.

## Step 6 — Merge or Discard

From the dashboard toolbar (or via CLI):

```bash
# Merge the worktree branch to main
git -C ~/.agent-mc/worktrees/feat-add-login-page-backend-1 \
    merge --no-ff main

# Or clean up without merging
rm -rf ~/.agent-mc/worktrees/feat-add-login-page-backend-1
```

## Keyboard Shortcuts (React App)

| Key | Action |
|-----|--------|
| `N` | New session |
| `S` | Spawn agent |
| `A` | Approve pending action |
| `R` | Reject pending action |
| `T` | Terminate focused agent |
| `?` | Show all shortcuts |

## Troubleshooting

**Agent card doesn't appear:**
- Check the bridge is running: `cat ~/.agent-mc/state/heartbeat.json`
- Check command syntax: `cat ~/.agent-mc/commands/*.json | jq .`
- Check audit log: `tail -f ~/.agent-mc/logs/audit_$(date +%Y-%m-%d).jsonl | jq .`

**Agent stuck on `running` for 10+ minutes:**
- Check the bridge health checker — it will flag stale agents automatically
- Manually terminate: write a `terminate_agent` command with the same `session_id` and `agent_key`

**Cost counter shows $0.00:**
- Enable Supabase in `config.json` — cost tracking requires Supabase sync
