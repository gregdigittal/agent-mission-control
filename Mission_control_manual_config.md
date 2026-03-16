# Mission Control — Manual Production Steps

These are the actions Claude can't do because they require your VPS access, Supabase dashboard, and domain registrar.

---

## Step 1 — Rotate the Supabase anon key

The key currently in `dashboard/index.html` is live in the git history. Even after stripping it from the file, it exists in past commits.

1. Go to [https://supabase.com](https://supabase.com) → project `zpsnbogldtepmfwgqarz` → **Settings → API**
2. Click **Regenerate** next to the `anon` key
3. Copy the new key — you'll need it in steps 3 and 4

> The old key will stop working immediately for anyone who cloned the repo.

---

## Step 2 — Set GitHub Actions secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret name | Where to get it |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | vercel.com → Settings → General → "Team ID" (starts with `team_`) |
| `VERCEL_PROJECT_ID` | vercel.com → Your project → Settings → General → "Project ID" |

---

## Step 3 — Set Vercel environment variables

In Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://zpsnbogldtepmfwgqarz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(new key from Step 1)* |

Set both for **Production**, **Preview**, and **Development** environments.

Then trigger a redeploy: Vercel dashboard → **Deployments → Redeploy** (or push any commit).

---

## Step 4 — Deploy the Supabase edge function

On your local machine (needs Supabase CLI):

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref zpsnbogldtepmfwgqarz

# Apply the RLS migration (after the prompt above creates it)
supabase db push

# Deploy the ingest-state edge function
supabase functions deploy ingest-state --project-ref zpsnbogldtepmfwgqarz

# Set the write secret (generate a strong random value)
supabase secrets set AMC_WRITE_SECRET=$(openssl rand -hex 32) --project-ref zpsnbogldtepmfwgqarz
```

Save the `AMC_WRITE_SECRET` value — the bridge needs it in `~/.agent-mc/config.json`.

---

## Step 5 — VPS: run the bridge as a service

SSH into your VPS, then:

```bash
# Pull the latest code
cd /home/gregmorris/agent-mission-control
git pull

# Build the bridge
cd bridge && npm install && npm run build && cd ..

# Run install script if first time
cd bridge && ./install.sh /home/gregmorris/agent-mission-control && cd ..

# Install the systemd service (after the prompt above creates bridge/agent-bridge.service)
sudo cp bridge/agent-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agent-bridge
sudo systemctl start agent-bridge

# Verify it's running
sudo systemctl status agent-bridge
```

---

## Step 6 — VPS: start the dashboard container

```bash
cd /home/gregmorris/agent-mission-control

# Create state file if it doesn't exist
cp agent_state_example.json agent_state.json

# Start the container
docker compose up -d

# Verify
docker compose ps
curl http://localhost:8090/health
```

---

## Step 7 — VPS: set up HTTPS with Caddy

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Edit the Caddyfile (after the prompt creates infra/Caddyfile, use it as your template)
sudo nano /etc/caddy/Caddyfile
```

Paste (replacing `yourdomain.com` with your actual domain):

```
yourdomain.com {
    reverse_proxy localhost:8090
}
```

```bash
sudo systemctl reload caddy

# Caddy auto-provisions TLS via Let's Encrypt — verify:
curl https://yourdomain.com/health
```

> Make sure your domain's A record points to the VPS IP before running this. Caddy will fail cert provisioning if DNS isn't resolving yet.

---

## Step 8 — Point DNS

In your domain registrar / DNS provider, add:

| Type | Name | Value |
|---|---|---|
| A | `@` or `yourdomain.com` | *(your VPS IP)* |
| A | `app` | *(your VPS IP, if self-hosting the React app)* |

DNS propagation takes 1–60 minutes. Check with `dig yourdomain.com`.

---

## Verification checklist

Once all steps are done:

- [ ] `curl https://yourdomain.com/health` returns `{"status":"ok"}`
- [ ] Dashboard loads at `https://yourdomain.com` with no console errors
- [ ] `systemctl status agent-bridge` shows `active (running)`
- [ ] `docker compose ps` shows `agent-mission-control` as `healthy`
- [ ] React app loads and connects to Supabase (check network tab for Supabase calls)
- [ ] CI passes on GitHub (all 6 jobs green)
- [ ] Old anon key no longer works (test by making a direct Supabase call with it)
