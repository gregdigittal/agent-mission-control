# Bridge Setup on VPS

Run the bridge headlessly on a remote VPS. The dashboard (Vercel or local browser) controls and monitors agents via Supabase — no browser required on the VPS.

## Requirements

- Node.js 20+ LTS
- Git
- Claude CLI authenticated (`claude auth login`)
- A Supabase project (shared with the dashboard)

---

## 1. Run the commands table migration

In the **Supabase dashboard → SQL editor**, run the contents of:

```
bridge/supabase/commands_table.sql
```

This creates the `commands` table that the dashboard uses to send remote control commands to the bridge.

---

## 2. Clone and build

```bash
git clone https://github.com/<your-org>/agent-mission-control.git
cd agent-mission-control/bridge
npm install
npm run build
```

---

## 3. Initialise config

```bash
node dist/index.js --init /path/to/your/project
```

This creates `~/.agent-mc/config.json` with defaults.

---

## 4. Configure Supabase in `~/.agent-mc/config.json`

```json
{
  "repo_path": "/path/to/your/project",
  "supabase": {
    "url": "https://zpsnbogldtepmfwgqarz.supabase.co",
    "anon_key": "<your-anon-key>",
    "enabled": true
  }
}
```

---

## 5. Set the service role key

The bridge needs the service role key to read commands from Supabase (bypasses RLS).

```bash
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

Add to `~/.bashrc` or `~/.zshrc` for persistence:

```bash
echo 'export SUPABASE_SERVICE_ROLE_KEY="<your-key>"' >> ~/.bashrc
source ~/.bashrc
```

Find the key in: **Supabase dashboard → Project Settings → API → service_role secret**.

---

## 6. Optional: set node identity

```bash
export VPS_NODE_ID="vps-1"        # label shown in the dashboard VPS panel
export VPS_REGION="eu-west-1"     # informational label
```

---

## 7. Run (development / test)

```bash
node dist/index.js
```

Expected startup output:

```
┌─────────────────────────────────────┐
│   Agent Mission Control — Bridge     │
├─────────────────────────────────────┤
│  Repo:     /path/to/your/project
│  Supabase: enabled
│  Token:    a1b2c3d4...
└─────────────────────────────────────┘
[vps] Registered as node: vps-1 (region: eu-west-1)
[bridge] Running main loop every 2000ms. Press Ctrl+C to stop.
```

---

## 8. Run as a systemd service (production)

A unit file is included at `bridge/agent-bridge.service`.

```bash
# Copy and configure the unit file
sudo cp agent-bridge.service /etc/systemd/system/

# Edit the file to set your user, working directory, and env vars
sudo nano /etc/systemd/system/agent-bridge.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable agent-bridge
sudo systemctl start agent-bridge

# Tail logs
sudo journalctl -u agent-bridge -f
```

---

## 9. Deploy the dashboard on Vercel

The React app (`app/`) deploys to Vercel and connects to the same Supabase project.

**Required env vars in Vercel dashboard → Settings → Environment Variables:**

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://zpsnbogldtepmfwgqarz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `AGENT_MC_API_SECRET` | a random secret (`openssl rand -hex 32`) |

**Deploy steps:**
1. Go to [vercel.com/new](https://vercel.com/new) → import `agent-mission-control`
2. Set **Root Directory** → `app`
3. Add the env vars above
4. Deploy

---

## Verify it's working

1. Open the dashboard (Vercel URL or `npm run dev` locally)
2. Log in with your Supabase account
3. Check **VPS panel** — your node should appear as **healthy** within 30 seconds
4. Spawn an agent from the dashboard — it appears on the VPS within one loop cycle (≤2s)
5. Agent status, costs, and events stream back via Supabase Realtime

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Node not appearing in VPS panel | `SUPABASE_SERVICE_ROLE_KEY` not set | Export the key and restart |
| Commands not executing | `commands` table missing | Run `bridge/supabase/commands_table.sql` in Supabase SQL editor |
| Agents not visible | `supabase.enabled` is `false` in config | Set to `true` in `~/.agent-mc/config.json` |
| `claude` not found | Claude CLI not installed or not in PATH | Run `claude auth login` and verify `which claude` |
