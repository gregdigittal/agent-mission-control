---
id: react-app
title: React App (Vercel)
sidebar_position: 2
---

# React App

The React app (`app/`) is the full-featured open-source dashboard built with React 18, Vite, TypeScript, and Tailwind CSS. It is designed to be deployed to Vercel.

## Features

- Everything in the MVP dashboard, plus:
- Multi-pane layout (configurable tile grid)
- Screen profile support (ultrawide / desktop / laptop / mobile)
- Supabase Auth integration
- Route-based navigation with auth guard
- Kanban board with drag-and-drop (@dnd-kit)
- VPS node management panel
- Cost tracking with per-model breakdown
- Agent diff viewer and build banners

## Local Development

```bash
cd app
cp .env.example .env
# Edit .env — add your Supabase URL and anon key

npm install
npm run dev
# Open http://localhost:5173
```

## Environment Variables

```bash
# app/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`.env` is gitignored. Never commit real credentials.

## Deploying to Vercel

### One-click deploy

1. Fork the repository
2. Import the repo into Vercel (vercel.com/new)
3. Set the **Root Directory** to `app`
4. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Deploy

Vercel auto-detects Vite and runs `npm run build` with output in `dist/`.

### Vercel CLI

```bash
cd app
npm install -g vercel
vercel --prod
# Follow prompts; add env vars when asked
```

## Self-Hosting

To self-host instead of using Vercel:

```bash
cd app
npm run build
# Serve the dist/ directory with any static file server

npx serve dist -p 4173
# Or copy dist/ to nginx / Caddy webroot
```

See [TLS / Reverse Proxy](../infra/tls) for nginx and Caddy configuration.

## Type Checking and Linting

```bash
cd app
npx tsc --noEmit   # type check
npm run lint       # ESLint
npm test           # Vitest unit tests
```

## Architecture Notes

- All Supabase queries go through `app/src/lib/supabase.ts` — components never call the Supabase SDK directly
- State management uses Zustand stores in `app/src/stores/` (one store per domain)
- Every route except `/login` is wrapped in an `AuthGuard`
- The app reads from Supabase Realtime subscriptions for live agent updates; it falls back to REST polling if Realtime is unavailable
