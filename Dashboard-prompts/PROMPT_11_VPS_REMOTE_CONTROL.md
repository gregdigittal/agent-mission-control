# Prompt 11 — VPS Remote Control & Monitoring

## Goal

Enable the bridge daemon to run headlessly on a remote VPS (no browser) while the React dashboard — deployed on Vercel — remotely controls and monitors it via Supabase as the shared transport. The user opens the dashboard in a browser on any device, and it talks to Claude Code agents running on the VPS.

---

## Architecture

```
┌─────────────────────────────────┐
│   Browser (any device)          │
│   dashboard.vercel.app          │
└────────────┬────────────────────┘
             │ Supabase Realtime (state)
             │ Supabase INSERT (commands)
             ▼
┌─────────────────────────────────┐
│   Supabase                      │
│   • commands table (queue)      │
│   • agents table (state)        │
│   • events table (activity)     │
│   • vps_nodes table (health)    │
└────────────┬────────────────────┘
             │ bridge polls every 2s
             ▼
┌─────────────────────────────────┐
│   VPS — bridge daemon           │
│   Node.js, no browser           │
│   Spawns claude --headless      │
└─────────────────────────────────┘
```

**Command flow:**
`Dashboard → Supabase commands table → Bridge polls → executeCommand() → Claude Code agent`

**State flow:**
`Agent process → Bridge aggregates → syncToSupabase() → Supabase agents/events → Dashboard Realtime`

---

## What Already Works (do not change)

- `bridge/src/supabase/sync.ts` — `syncToSupabase()` pushes agent state to Supabase every loop ✅
- `app/src/hooks/useCommand.ts` — `send()` inserts into Supabase `commands` table ✅
- `bridge/src/commands/processor.ts` — `executeCommand()` dispatcher handles all command types ✅
- `bridge/src/supabase/client.ts` — `getSupabaseAdminClient()` using service role key ✅

**The single gap:** `pullCommandsFromSupabase()` in `sync.ts` is a stub (comment only). The bridge never reads the `commands` table. This is the only missing link.

---

## Part 1 — Bridge: Implement Supabase Command Polling

### 1a. Supabase `commands` table schema

The `commands` table must have these columns (add via Supabase SQL editor if not present):

```sql
create table if not exists public.commands (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  payload      jsonb not null default '{}',
  session_token text not null default '',
  created_by   uuid references auth.users(id),
  status       text not null default 'pending',  -- pending | processing | done | error
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

-- Bridge reads using service role key (bypasses RLS)
-- Dashboard writes using anon key + RLS
alter table public.commands enable row level security;

-- Users can insert their own commands
create policy "Users can insert commands" on public.commands
  for insert to authenticated
  with check (created_by = auth.uid());

-- Users can read their own commands (for status polling)
create policy "Users can read own commands" on public.commands
  for select to authenticated
  using (created_by = auth.uid());
```

### 1b. Implement `pullCommandsFromSupabase()` in `bridge/src/supabase/sync.ts`

Replace the stub with a full implementation:

```typescript
export async function pullCommandsFromSupabase(): Promise<number> {
  const client = await getSupabaseAdminClient();   // service role — bypasses RLS
  if (!client) return 0;

  // Fetch all pending commands, oldest first
  const { data, error } = await client
    .from('commands')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    console.warn('[supabase:commands] Fetch error:', error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  let processed = 0;

  for (const row of data) {
    // Mark as processing (prevents double-execution if loop overlaps)
    await client
      .from('commands')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending');  // conditional update — idempotency guard

    try {
      // Normalise to the shape executeCommand() expects
      const cmd = {
        id: row.id,
        type: row.type,
        timestamp: row.created_at,
        session_token: row.session_token ?? '',
        payload: row.payload ?? {},
      };

      // Reuse the existing dispatcher — same validation and execution logic
      await executeCommand(cmd);

      await client
        .from('commands')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', row.id);

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await client
        .from('commands')
        .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
        .eq('id', row.id);

      await audit('supabase_command_error', { commandId: row.id, type: row.type, error: message });
      console.error(`[supabase:commands] Failed to execute ${row.type} (${row.id}):`, message);
    }
  }

  return processed;
}
```

`executeCommand` is currently unexported from `processor.ts`. Export it:

In `bridge/src/commands/processor.ts`, change:
```typescript
async function executeCommand(cmd: Command): Promise<void> {
```
to:
```typescript
export async function executeCommand(cmd: Command): Promise<void> {
```

Import it in `sync.ts`:
```typescript
import { executeCommand } from '../commands/processor.js';
```

**Session token validation:** The bridge's `validateToken()` checks against the locally generated session token. Remote commands arrive with a Supabase JWT access token instead, which won't match. In `pullCommandsFromSupabase()`, skip `validateToken()` — authentication is handled by Supabase RLS (only authenticated users can insert) and the service role key read ensures only the bridge can fetch commands.

### 1c. Wire into the main loop (`bridge/src/index.ts`)

In the `loop()` function, add Supabase command polling alongside filesystem polling:

```typescript
// 2. Command Processing
const fsCommands = await processCommands();           // existing filesystem IPC
const remoteCommands = config.supabase.enabled        // NEW: Supabase command channel
  ? await pullCommandsFromSupabase()
  : 0;
const commandsProcessed = fsCommands + remoteCommands;
```

---

## Part 2 — Bridge: VPS Node Registration

On startup (`init()` function in `bridge/src/index.ts`), register this bridge instance in the `vps_nodes` table so the dashboard can display it:

```typescript
import { registerVpsNode } from './vps/registration.js';

// In init(), after loading config:
if (config.supabase.enabled) {
  await registerVpsNode();
}
```

Create `bridge/src/vps/registration.ts`:

```typescript
import { hostname } from 'node:os';
import { getSupabaseAdminClient } from '../supabase/client.js';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';

export async function registerVpsNode(): Promise<void> {
  const client = await getSupabaseAdminClient();
  if (!client) {
    console.warn('[vps] SUPABASE_SERVICE_ROLE_KEY not set — node registration skipped');
    return;
  }

  const config = await loadConfig();
  const nodeId = process.env['VPS_NODE_ID'] ?? hostname();

  const { error } = await client.from('vps_nodes').upsert({
    id: nodeId,
    name: nodeId,
    host: hostname(),
    region: process.env['VPS_REGION'] ?? 'local',
    health: 'healthy',
    agent_count: 0,
    agent_capacity: config.max_agents,
    last_heartbeat: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[vps] Node registration failed:', error.message);
    await audit('vps_registration_error', { error: error.message });
  } else {
    console.log(`[vps] Registered as node: ${nodeId}`);
  }
}
```

Also update the heartbeat write in `syncToSupabase()` — replace the comment placeholder with an actual upsert:

```typescript
if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
  lastHeartbeat = now;
  const nodeId = process.env['VPS_NODE_ID'] ?? hostname();
  const agentCount = state.sessions.reduce((n, s) => n + s.agents.length, 0);
  await client.from('vps_nodes').update({
    last_heartbeat: new Date().toISOString(),
    agent_count: agentCount,
    health: 'healthy',
  }).eq('id', nodeId);
}
```

Add `import { hostname } from 'node:os';` to `sync.ts`.

---

## Part 3 — App: Command Routing (no changes needed — already correct)

`app/src/hooks/useCommand.ts` already inserts into Supabase `commands` table with `status: 'pending'`. This is the correct remote path.

**One fix needed:** The `session_token` field sent by the app is the Supabase JWT access token. The bridge's `pullCommandsFromSupabase()` (above) skips `validateToken()` for Supabase-sourced commands, so this is fine. No app changes required.

**Verify** that the UI components that spawn/terminate agents use `useCommand` and not the old `writeCommand` from `api/_commands.ts`. Search for `writeCommand` usage in `app/src/` — if found, replace with `useCommand().send()`.

---

## Part 4 — Vercel Deployment

### Environment variables (set in Vercel dashboard → Settings → Environment Variables)

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://zpsnbogldtepmfwgqarz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<your anon key>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<your service role key>` (for Vercel serverless API routes) |
| `AGENT_MC_API_SECRET` | `<your secret>` (already generated locally) |
| `VITE_API_BASE_URL` | Leave blank (same origin on Vercel) |

**Do not set `BRIDGE_COMMAND_DIR`** — commands go through Supabase, not the local filesystem.

### Deploy steps

1. Import `agent-mission-control` repo in [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** → `app`
3. Add the env vars above
4. Deploy — Vercel auto-detects Vite and runs `npm run build`

The `vercel.json` SPA rewrite rule is already in place.

---

## Part 5 — VPS Setup Guide

Create `bridge/VPS_SETUP.md` with the following content. This is a markdown guide, not code:

```markdown
# Bridge Setup on VPS

## Requirements
- Node.js 20+ LTS
- Git
- Claude CLI authenticated (`claude auth`)

## Steps

### 1. Clone and build
```bash
git clone https://github.com/<your-org>/agent-mission-control.git
cd agent-mission-control/bridge
npm install
npm run build
```

### 2. Initialise config
```bash
node dist/index.js --init /path/to/your/project
```
This creates `~/.agent-mc/config.json`.

### 3. Configure Supabase in `~/.agent-mc/config.json`
```json
{
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "<your-anon-key>",
    "enabled": true
  }
}
```

### 4. Set the service role key (bridge needs this to read commands)
```bash
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```
Add this to `~/.bashrc` or `~/.zshrc` for persistence.

### 5. Optional: set node identity
```bash
export VPS_NODE_ID="vps-1"       # shows in dashboard VPS panel
export VPS_REGION="eu-west-1"    # informational label
```

### 6. Run (development)
```bash
node dist/index.js
```

### 7. Run as a systemd service (production)
The `bridge/agent-bridge.service` systemd unit file is included.
Copy and enable it:
```bash
sudo cp agent-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agent-bridge
sudo systemctl start agent-bridge
sudo journalctl -u agent-bridge -f   # tail logs
```

## Verify it's working
1. Open the dashboard (Vercel URL or local `npm run dev`)
2. Log in
3. Check the VPS panel — your node should appear as **healthy**
4. Try spawning an agent from the dashboard — it should appear within 2–4 seconds
```

---

## Files to Create

```
bridge/src/
└── vps/registration.ts          ← new

bridge/
└── VPS_SETUP.md                 ← new (markdown guide)
```

## Files to Modify

```
bridge/src/
├── supabase/sync.ts             ← implement pullCommandsFromSupabase(), fix heartbeat
├── commands/processor.ts        ← export executeCommand
└── index.ts                     ← wire pullCommandsFromSupabase + registerVpsNode
```

---

## Acceptance Criteria

1. `bridge$ npm run build` exits 0 — no TypeScript errors
2. Bridge startup prints `[vps] Registered as node: <hostname>` when Supabase is enabled
3. Dashboard VPS panel shows the running bridge node as **healthy**
4. Spawning an agent from the Vercel dashboard creates a real `claude --headless` process on the VPS within one loop cycle (≤2s)
5. Agent status, cost, and events appear in the dashboard via Supabase Realtime
6. A command inserted into Supabase with `status: pending` is picked up and executed by the bridge, then marked `done`
7. No filesystem writes required for remote command routing — `BRIDGE_COMMAND_DIR` is unused in remote mode

---

## Non-Goals

- Do not add per-VPS command routing (node_id filtering) — all bridges read all pending commands and skip ones for sessions they don't own (session ownership is implicit from the spawned agent registry)
- Do not modify the dashboard UI — the VPS panel (`VPSManager.tsx`) already exists and will display registered nodes automatically
- Do not add SSH tunnelling or direct VPS-to-dashboard connections — Supabase is the only transport
