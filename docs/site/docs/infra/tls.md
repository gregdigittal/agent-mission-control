---
id: tls
title: TLS / Reverse Proxy
sidebar_position: 1
---

# TLS / Reverse Proxy

Template configs for putting the Agent Mission Control dashboard behind HTTPS. Two options are provided — use whichever you prefer.

The bridge itself has **no network listeners** — it communicates via filesystem IPC only. The reverse proxy is for the dashboard frontend exclusively.

## Which Port Does the Dashboard Run On?

The MVP dashboard runs on port **8090** by default:

```bash
cd dashboard && python3 -m http.server 8090
```

Both Caddy and nginx proxy `https://YOURDOMAIN.COM` → `localhost:8090`.

## Option A — Caddy (recommended)

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
3. Ports 80 and 443 must be open in your firewall.

### Deploy

```bash
sudo cp infra/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy handles certificate provisioning on first request. Check logs with:

```bash
sudo journalctl -u caddy -f
```

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

3. Issue a TLS certificate:

```bash
sudo certbot --nginx -d YOURDOMAIN.COM
```

Certbot patches the nginx config with certificate paths and sets up auto-renewal.

### Renewal

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## React App

To self-host the React app (`app/`) instead of deploying to Vercel, build it and point the reverse proxy at the `dist/` directory or a Vite preview server. See the optional server block in `infra/nginx.conf`.

## Security Headers

Both configs apply:

- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- TLS 1.2 / 1.3 only — no legacy protocols
- Server version suppression (`server_tokens off`)
