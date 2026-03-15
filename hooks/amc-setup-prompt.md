# Agent Mission Control — Project Setup Prompt

Paste this at the start of any Claude Code session to enable full AMC live dashboard integration.

---

## The Prompt

```
Set up Agent Mission Control (AMC) integration for this project.

1. Detect the project name from the current working directory.

2. Create or update `agent_state.json` in the project root with the current project state:
   - Use the project directory name as `project`
   - Populate `stages` based on what you know about the work ahead (or default 8-stage pipeline)
   - Populate `agents` with yourself: id="claude-agent", name="Claude", type="leader", status="working", icon="◆"
   - Add a "Session started" event
   - Set realistic `totalTasks` and `completedTasks` from any BACKLOG.md or task list found

3. Push the state to Supabase using the environment-configured keys:
   ```sh
   AMC_SUPABASE_URL="${AMC_SUPABASE_URL}" \
   AMC_SUPABASE_KEY="${AMC_SUPABASE_KEY}" \
   ~/projects/agent-mission-control/hooks/write_state.sh < agent_state.json
   ```

4. Throughout the session, keep `agent_state.json` current by re-running the push:
   - After completing each task: update `completedTasks`, move the task to `done`
   - After starting a new task: add it to `agents[0].task`, set status to `in-progress`
   - After significant tool use: append to `events` (max 20 entries, drop oldest)
   - After stage transitions: update `currentStageIdx` and the relevant stage `status`

5. Confirm: "AMC live. Session visible at https://agent-mission-control-ruddy.vercel.app"
```

---

## What This Enables

- The hosted dashboard at `agent-mission-control-ruddy.vercel.app` shows this session live
- Switch to **SUPABASE** mode in the footer bar, enter your URL + anon key, hit START
- Each project appears as its own session tab
- The Kanban board, agent cards, and activity feed all reflect real work

## Environment Variables Required

These must be set in your shell or `.env`:

```sh
export AMC_SUPABASE_URL="https://your-project.supabase.co"
export AMC_SUPABASE_KEY="your-anon-key"   # or service-role key
```

Add to `~/.zshrc` or `~/.bashrc` for automatic availability in all projects.

## Automatic Hook (Zero Setup for New Projects)

`~/.claude/hooks/amc-session-init.sh` runs at every `SessionStart`. When
`AMC_SUPABASE_URL` and `AMC_SUPABASE_KEY` are set, it:

1. Creates `.claude/hooks/amc-push.sh` in the project
2. Registers it as a `PostToolUse` hook in `.claude/settings.json`
3. After each Bash/Edit/Write: pushes `agent_state.json` if present, or a
   live heartbeat showing Claude is active + which tool just ran

This means any project you open automatically appears in the dashboard as long
as the env vars are exported — no manual setup needed.
