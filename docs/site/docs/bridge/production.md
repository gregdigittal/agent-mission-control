---
id: production
title: Running in Production
sidebar_position: 3
---

# Running in Production

For long-running deployments, run the bridge as a managed service so it restarts automatically on crash or reboot.

## Option A — systemd (recommended on Ubuntu/Debian/RHEL)

A unit file is included at `bridge/agent-bridge.service`.

```bash
# Copy to systemd and enable
sudo cp agent-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agent-bridge    # start on boot
sudo systemctl start agent-bridge

# Check status and logs
sudo systemctl status agent-bridge
sudo journalctl -u agent-bridge -f
```

The unit runs as `User=gregmorris`. If you deploy under a different user, edit the `User=` and `WorkingDirectory=` lines before copying.

## Option B — PM2

A PM2 ecosystem config is included at `bridge/pm2.config.js`.

```bash
# Install PM2 globally (once)
npm install -g pm2

# Start the bridge
pm2 start pm2.config.js

# Persist across reboots
pm2 save
pm2 startup   # follow the printed command

# Monitor
pm2 status
pm2 logs agent-bridge
```

PM2 logs are written to `~/.agent-mc/logs/pm2-out.log` and `pm2-err.log` by default. Adjust the `out_file` and `error_file` paths in `pm2.config.js` if your data directory differs.

## Checking Bridge Health

The bridge writes a `heartbeat.json` file to `~/.agent-mc/state/` on every loop cycle. You can check it to verify the bridge is running:

```bash
cat ~/.agent-mc/state/heartbeat.json
```

## Audit Logs

The bridge writes append-only JSONL audit logs to `~/.agent-mc/logs/audit_YYYY-MM-DD.jsonl`. These contain every command, spawn, termination, and state change.

```bash
# Tail the current day's log
tail -f ~/.agent-mc/logs/audit_$(date +%Y-%m-%d).jsonl | jq .

# Find all spawn events
grep '"event":"spawn"' ~/.agent-mc/logs/audit_$(date +%Y-%m-%d).jsonl | jq .
```

Logs rotate daily by creating a new file — existing log files are never modified.

## Updating the Bridge

```bash
cd bridge
git pull
npm run build
sudo systemctl restart agent-bridge   # or: pm2 restart agent-bridge
```

## Firewall Considerations

The bridge has **no network listeners** — it communicates exclusively via filesystem IPC and optional Supabase push. No inbound firewall rules are required for the bridge itself.

The dashboard frontend (MVP: port 8090, React app: port 5173 dev / Vercel in production) needs to be accessible to users. Put it behind a TLS reverse proxy — see [TLS / Reverse Proxy](../infra/tls).
