#!/usr/bin/env bash
# setup.sh — Agent Mission Control self-hosted setup
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# What this does:
#   1. Checks prerequisites (Docker, Node.js, npm)
#   2. Creates .env from .env.example if not already present
#   3. Builds bridge and mcp-server TypeScript sources
#   4. Applies Supabase migrations (if supabase CLI is available)
#   5. Starts the full self-hosted stack via docker compose
#
# After running: visit http://localhost:8090 for the dashboard.

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
error() { echo -e "${RED}[setup]${NC} $*" >&2; }

# ── Prerequisites ─────────────────────────────────────────────────────────────

info "Checking prerequisites…"

if ! command -v docker &>/dev/null; then
  error "Docker is not installed. See https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  error "Docker Compose plugin is not available. Update Docker Desktop or install the compose plugin."
  exit 1
fi

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install Node.js 20 LTS from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node --version | cut -d'.' -f1 | tr -d 'v')
if [[ "${NODE_VERSION}" -lt 20 ]]; then
  warn "Node.js 20+ is recommended. Found $(node --version)."
fi

info "Prerequisites OK."

# ── .env setup ────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${ENV_EXAMPLE}" ]]; then
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    warn "Created ${ENV_FILE} from ${ENV_EXAMPLE}."
    warn "Edit ${ENV_FILE} to set your ANTHROPIC_API_KEY, POSTGRES_PASSWORD, and other secrets before continuing."
    echo ""
    warn "Required variables:"
    warn "  ANTHROPIC_API_KEY   — your Anthropic API key"
    warn "  POSTGRES_PASSWORD   — password for the local Postgres database"
    warn ""
    read -rp "Press Enter after editing .env to continue, or Ctrl+C to stop now: "
  else
    error ".env.example not found. Cannot create .env automatically."
    error "Create .env manually with at minimum: ANTHROPIC_API_KEY, POSTGRES_PASSWORD"
    exit 1
  fi
else
  info ".env already exists — skipping."
fi

# Validate required variables
# shellcheck source=/dev/null
source "${ENV_FILE}"

MISSING_VARS=()
for var in ANTHROPIC_API_KEY POSTGRES_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("${var}")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  error "Missing required environment variables in .env:"
  for v in "${MISSING_VARS[@]}"; do
    error "  ${v}"
  done
  exit 1
fi

info "Environment variables validated."

# ── Build bridge ──────────────────────────────────────────────────────────────

info "Building bridge…"
(
  cd bridge
  npm ci --silent
  npm run build
)
info "Bridge built."

# ── Build mcp-server ──────────────────────────────────────────────────────────

info "Building mcp-server…"
(
  cd mcp-server
  npm ci --silent
  npm run build
)
info "MCP server built."

# ── Supabase migrations ───────────────────────────────────────────────────────

if command -v supabase &>/dev/null; then
  info "Running Supabase migrations…"
  supabase db push --local 2>/dev/null || warn "Migration push failed — you may need to apply supabase/migrations/*.sql manually."
else
  warn "Supabase CLI not found — skipping migrations."
  warn "Apply supabase/migrations/*.sql manually if using the local Postgres service."
fi

# ── Start self-hosted stack ───────────────────────────────────────────────────

info "Starting self-hosted stack…"
docker compose -f docker-compose.selfhost.yml up -d --build

echo ""
info "Setup complete!"
info "  Dashboard:        http://localhost:${DASHBOARD_PORT:-8090}"
info "  Supabase Studio:  http://localhost:${STUDIO_PORT:-3000}"
info "  Kong API:         http://localhost:${KONG_PORT:-8000}"
info "  MCP Server:       http://localhost:${MCP_PORT:-3001}"
echo ""
info "To check service health: docker compose -f docker-compose.selfhost.yml ps"
info "To stop: docker compose -f docker-compose.selfhost.yml down"
