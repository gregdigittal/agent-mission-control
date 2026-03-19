# Prompt 12 — Go Live on This VPS

## Context

This Claude Code session IS running on the target VPS. The Supabase project is
`zpsnbogldtepmfwgqarz` (eu-west-1). No pm2, psql, supabase CLI, or vercel CLI are
installed. Node.js 20 is available. The bridge is already built at
`/home/gregmorris/agent-mission-control/bridge/dist/`.

The goal is to fully go live:
1. Run the Supabase `commands` table migration
2. Install pm2 and start the bridge as a managed process
3. Deploy the React app to Vercel
4. Verify end-to-end

---

## Required Inputs

Before starting, collect the following from the user if not already set in the environment:

| Variable | Purpose | How to find it |
|----------|---------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Bridge reads commands table | Supabase dashboard → Project Settings → API → service_role secret |
| `SUPABASE_DB_PASSWORD` | Run SQL migration from this terminal | Supabase dashboard → Project Settings → Database → Database password |

Check if `SUPABASE_SERVICE_ROLE_KEY` is already set (`echo $SUPABASE_SERVICE_ROLE_KEY`).
If either value is missing, ask the user before proceeding.

---

## Step 1 — Run the Supabase Commands Table Migration

The migration SQL is at `bridge/supabase/commands_table.sql`.

First check if the `commands` table already exists by running this Node.js one-liner:

```bash
node -e "
const { createClient } = await import('./node_modules/@supabase/supabase-js/dist/module/index.js');
const client = createClient(
  'https://zpsnbogldtepmfwgqarz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { error } = await client.from('commands').select('id').limit(1);
if (error?.code === '42P01') {
  console.log('TABLE_MISSING');
} else if (error) {
  console.log('ERROR: ' + error.message);
} else {
  console.log('TABLE_EXISTS');
}
" 2>/dev/null
```

Run this check from `/home/gregmorris/agent-mission-control/bridge/`.

**If `TABLE_EXISTS`:** skip to Step 2.

**If `TABLE_MISSING`:** run the migration using Node.js with the `pg` package and the
database password:

```bash
# Install pg temporarily
npm install --no-save pg

# Run migration
node --input-type=module <<'EOF'
import pg from 'pg';
import { readFile } from 'node:fs/promises';

const sql = await readFile(
  '/home/gregmorris/agent-mission-control/bridge/supabase/commands_table.sql',
  'utf-8'
);

const client = new pg.Client({
  connectionString: `postgresql://postgres.zpsnbogldtepmfwgqarz:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
await client.end();
console.log('[migration] commands table created successfully');
EOF
```

**If `ERROR` (table check fails for another reason):** print the SQL file path and
the exact URL for the Supabase SQL editor
(`https://supabase.com/dashboard/project/zpsnbogldtepmfwgqarz/sql/new`) and ask the
user to paste and run the SQL manually, then confirm before continuing.

---

## Step 2 — Write Environment Variables

Write `SUPABASE_SERVICE_ROLE_KEY` and node identity to `~/.bashrc` so they persist
across restarts:

```bash
# Check if already written to avoid duplicates
grep -q 'SUPABASE_SERVICE_ROLE_KEY' ~/.bashrc || cat >> ~/.bashrc << 'ENVEOF'

# Agent Mission Control — bridge env vars
export SUPABASE_SERVICE_ROLE_KEY="PLACEHOLDER_KEY"
export VPS_NODE_ID="vps-main"
export VPS_REGION="eu-west-1"
ENVEOF
```

Replace `PLACEHOLDER_KEY` with the actual value using `sed` after writing.

Also export them in the current shell session so subsequent steps pick them up.

---

## Step 3 — Pull Latest Code and Rebuild Bridge

```bash
cd /home/gregmorris/agent-mission-control
git pull origin main

cd bridge
npm install
npm run build
```

Verify build succeeded: `ls dist/index.js` must exist.

---

## Step 4 — Install pm2 and Start the Bridge

```bash
npm install -g pm2
```

The pm2 config already exists at `bridge/pm2.config.js`. Update the `env` block to
include the required environment variables before starting:

Read `bridge/pm2.config.js`. Add `SUPABASE_SERVICE_ROLE_KEY`, `VPS_NODE_ID`, and
`VPS_REGION` to the `env` object in the config:

```js
env: {
  NODE_ENV: 'production',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  VPS_NODE_ID: 'vps-main',
  VPS_REGION: 'eu-west-1',
},
```

Then start:

```bash
cd /home/gregmorris/agent-mission-control/bridge
pm2 start pm2.config.js
pm2 save          # persist across reboots
pm2 startup       # generate systemd startup script (run the printed command as sudo)
```

Verify the bridge is running:

```bash
pm2 status
pm2 logs agent-bridge --lines 20
```

Look for:
- `[vps] Registered as node: vps-main (region: eu-west-1)`
- `[bridge] Running main loop every 2000ms`

If either is missing, check `pm2 logs agent-bridge --err` and surface the error.

---

## Step 5 — Deploy React App to Vercel

Install the Vercel CLI:

```bash
npm install -g vercel
```

Log in (this will print a URL — open it in a browser to authenticate):

```bash
cd /home/gregmorris/agent-mission-control/app
vercel login
```

Deploy with all required env vars:

```bash
vercel --prod \
  --yes \
  -e VITE_SUPABASE_URL="https://zpsnbogldtepmfwgqarz.supabase.co" \
  -e VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc25ib2dsZHRlcG1md2dxYXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODI5MjgsImV4cCI6MjA4ODY1ODkyOH0.5JVA7ZBNYMvraIRVlHN_dwn31kleTnRSD-RNBis7bPs" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -e AGENT_MC_API_SECRET="e40c2960251a7436f3f705107f907627a62f3267a00df42ac972e99924afdd86"
```

Capture the deployment URL printed by Vercel and report it to the user.

**If `vercel login` requires interactive browser auth and blocks:** print the login
URL clearly for the user, wait for them to confirm they've authenticated, then
re-run the deploy command.

---

## Step 6 — End-to-End Verification

Run these checks and report results for each:

```bash
# 1. Bridge process is running
pm2 status | grep agent-bridge

# 2. Bridge registered as VPS node (Supabase row exists)
node -e "
const { createClient } = await import('./node_modules/@supabase/supabase-js/dist/module/index.js');
const client = createClient(
  'https://zpsnbogldtepmfwgqarz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { data, error } = await client.from('vps_nodes').select('id,health,last_heartbeat').eq('id','vps-main');
console.log(JSON.stringify(data ?? error));
" 2>/dev/null

# 3. Commands table exists and is empty (ready for commands)
node -e "
const { createClient } = await import('./node_modules/@supabase/supabase-js/dist/module/index.js');
const client = createClient(
  'https://zpsnbogldtepmfwgqarz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { count, error } = await client.from('commands').select('*', { count: 'exact', head: true });
console.log(error ? 'ERROR: ' + error.message : 'commands table ok, rows: ' + count);
" 2>/dev/null

# 4. Bridge log tail — no errors in last 10 lines
pm2 logs agent-bridge --lines 10 --nostream
```

Report the Vercel deployment URL and a summary of all check results.

---

## Error Handling

- If `npm run build` fails: run `npx tsc --noEmit` in `bridge/` and surface the first 5 type errors
- If pm2 start fails: show the last 20 lines of `~/.agent-mc/logs/pm2-err.log`
- If Vercel deploy fails: show the full error output; common fix is `vercel link` first to associate with an existing project
- If the VPS node doesn't appear in Supabase: check `SUPABASE_SERVICE_ROLE_KEY` is set in the pm2 env block and `pm2 restart agent-bridge`

---

## Acceptance Criteria

1. `pm2 status` shows `agent-bridge` as **online**
2. `vps_nodes` Supabase table has a row for `vps-main` with `health: healthy`
3. `commands` table exists in Supabase
4. Vercel deployment URL is live and loads the login page
5. No errors in bridge logs
