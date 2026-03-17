FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Install claude CLI — required for spawning agents
RUN npm install -g @anthropic-ai/claude-code

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Default command and config directory
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
