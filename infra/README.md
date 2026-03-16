# infra — TLS / Reverse Proxy Configuration

Template configs for putting the Agent Mission Control dashboard behind HTTPS. Two options are provided — use whichever you prefer.

---

## Option A — Caddy (recommended for simplicity)

Caddy automatically provisions and renews Let's Encrypt certificates with zero configuration.

### Install

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### Configure

1. Edit `infra/Caddyfile` — replace every `YOURDOMAIN.COM` with your real domain.
2. Ensure your domain's DNS A record points to this server's public IP.
3. Port 80 and 443 must be open in your firewall.

### Deploy

```bash
sudo cp infra/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy   # or: sudo caddy run --config /etc/caddy/Caddyfile
```

Caddy handles certificate provisioning on first request. Check logs with:

```bash
sudo journalctl -u caddy -f
```

---

## Option B — nginx + certbot

Use this if you prefer nginx or already have it running on the server.

### Install

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Configure

1. Edit `infra/nginx.conf` — replace every `YOURDOMAIN.COM` with your real domain.
2. Copy to sites-available and enable:

```bash
sudo cp infra/nginx.conf /etc/nginx/sites-available/agent-mission-control
sudo ln -s /etc/nginx/sites-available/agent-mission-control \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

3. Issue a TLS certificate with certbot:

```bash
sudo certbot --nginx -d YOURDOMAIN.COM
```

Certbot patches the nginx config with the certificate paths and sets up auto-renewal.

### Renewal

Certbot installs a systemd timer that auto-renews before expiry. Verify it:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## Which Port Does the Dashboard Run On?

The MVP dashboard (`dashboard/index.html`) is a static file served on port **8090** by default:

```bash
cd dashboard && python3 -m http.server 8090
```

Both Caddy and nginx proxy `https://YOURDOMAIN.COM` → `localhost:8090`. Adjust the port in the config if you serve on a different port.

---

## React App

To self-host the React app (`app/`) instead of deploying to Vercel, uncomment the optional server block in either config file and point it at your build output or Vite dev server.

---

## Self-Hosted with Docker

`docker-compose.selfhost.yml` at the project root provides a fully self-hosted stack with four services:

| Service | Image | Default Port | Purpose |
|---------|-------|-------------|---------|
| `dashboard` | `nginx:alpine` | 8090 | Serves `dashboard/index.html` |
| `supabase-db` | `supabase/postgres:15` | — (internal) | PostgreSQL database |
| `supabase-kong` | `kong:3.4-alpine` | 8000 | API gateway (routes `/rest/v1/`, `/auth/v1/`) |
| `supabase-studio` | `supabase/studio:latest` | 3000 | Supabase Studio management UI |

### Required Environment Variables

Create a `.env` file in the project root (gitignored):

```bash
# Required
POSTGRES_PASSWORD=your-strong-password-here

# Optional — set to use Studio with JWT auth
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key
```

### How to Run

```bash
# Start all services
docker compose -f docker-compose.selfhost.yml up -d

# Check service status
docker compose -f docker-compose.selfhost.yml ps

# View logs
docker compose -f docker-compose.selfhost.yml logs -f

# Stop services
docker compose -f docker-compose.selfhost.yml down
```

### Accessing Services

- **AMC Dashboard:** http://localhost:8090
- **Supabase Studio:** http://localhost:3000
- **Kong API Gateway:** http://localhost:8000

### Customising Ports

Copy the provided example override file and edit it:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
# Edit ports, env vars, and volume mounts as needed
```

Docker Compose automatically merges `docker-compose.override.yml` when it is present.

### Kong Configuration

The API gateway uses a declarative config at `infra/kong.yml`. This file routes `/rest/v1/` and `/auth/v1/` to the appropriate backend services. Edit it to add authentication plugins, rate limiting, or additional routes for a production deployment.

### Data Persistence

PostgreSQL data is stored in a named Docker volume (`supabase-db-data`). This volume persists across container restarts. To reset the database:

```bash
docker compose -f docker-compose.selfhost.yml down -v
```

---

## Security Notes

- Both configs apply security headers (HSTS, X-Frame-Options, X-Content-Type-Options).
- TLS 1.2 / 1.3 only — no legacy protocols.
- `server_tokens off` / `-Server` suppresses version disclosure.
- The bridge itself has **no network listeners** — it communicates via filesystem IPC only. The reverse proxy is for the dashboard frontend exclusively.
