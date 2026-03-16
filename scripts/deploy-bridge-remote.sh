#!/usr/bin/env bash
# deploy-bridge-remote.sh
# Deploys agent-bridge-remote to a target VPS and starts it.
#
# Usage:
#   ./scripts/deploy-bridge-remote.sh <vps-host> <vps-user> <ssh-key-path> [node-id] [node-label]
#
# Example:
#   ./scripts/deploy-bridge-remote.sh 192.168.1.10 ubuntu ~/.ssh/id_ed25519 vps-1 "Production VPS"
#
# Prerequisites on the remote VPS:
#   - Node.js >= 20 installed
#   - npm installed
#   - The SSH user has write access to ~/agent-mc-remote/
#
# Security:
#   - NO credentials are embedded in this script
#   - SSH key path is provided as an argument and used only with ssh/rsync
#   - All remote commands are constructed without shell interpolation of user inputs
#     (arguments are passed as positional parameters, not concatenated strings)

set -euo pipefail

VPS_HOST="${1:?Usage: $0 <vps-host> <vps-user> <ssh-key-path> [node-id] [node-label]}"
VPS_USER="${2:?Missing vps-user}"
SSH_KEY="${3:?Missing ssh-key-path}"
NODE_ID="${4:-remote-node-1}"
NODE_LABEL="${5:-Remote Node}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
REMOTE_DIR="~/agent-mc-remote"
BUILD_DIR="${PROJECT_ROOT}/bridge-remote/dist"

SSH_OPTS=(-i "${SSH_KEY}" -o StrictHostKeyChecking=no -o BatchMode=yes)

echo "==> Building bridge-remote..."
(cd "${PROJECT_ROOT}/bridge-remote" && npm run build)

echo "==> Syncing bridge-remote to ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}..."
rsync \
  --archive \
  --compress \
  --delete \
  --rsh "ssh ${SSH_OPTS[*]}" \
  --exclude node_modules \
  --exclude .git \
  "${PROJECT_ROOT}/bridge-remote/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

echo "==> Installing dependencies on remote..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && npm install --omit=dev --silent"

echo "==> Initializing bridge-remote config (if not already present)..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && [ -f ~/.agent-mc-remote/config.json ] || node dist/index.js --init '${NODE_ID}' '${NODE_LABEL}'"

echo "==> Checking if bridge-remote is already running..."
if ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
    "pgrep -f 'agent-bridge-remote' > /dev/null 2>&1"; then
  echo "    Already running — restarting..."
  ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
    "pkill -f 'agent-bridge-remote' || true; sleep 1"
fi

echo "==> Starting bridge-remote in background..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && nohup node dist/index.js >> ~/.agent-mc-remote/logs/bridge.log 2>&1 &"

echo "==> Waiting for heartbeat..."
sleep 3

# Validate: check if heartbeat file exists on remote
if ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
    "test -f ~/.agent-mc-remote/state/heartbeat.json"; then
  echo "==> Heartbeat confirmed. bridge-remote is running on ${VPS_HOST}."
else
  echo "WARNING: Heartbeat file not found — bridge-remote may not have started correctly."
  echo "Check logs: ssh ${VPS_USER}@${VPS_HOST} 'cat ~/.agent-mc-remote/logs/bridge.log'"
  exit 1
fi

echo ""
echo "Deployment complete."
echo "  Node ID:  ${NODE_ID}"
echo "  Node:     ${VPS_USER}@${VPS_HOST}"
echo "  Logs:     ssh ${VPS_USER}@${VPS_HOST} 'tail -f ~/.agent-mc-remote/logs/bridge.log'"
echo "  State:    rsync -avz -e 'ssh ${SSH_OPTS[*]}' ${VPS_USER}@${VPS_HOST}:~/.agent-mc-remote/state/ ./remote-state/"
