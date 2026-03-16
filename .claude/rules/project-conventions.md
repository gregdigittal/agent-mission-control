# Project Conventions — Agent Mission Control

## Dashboard (`dashboard/`)

- **Vanilla HTML/CSS/JS only** — no framework, no build step, no bundler
- Single-file architecture: `dashboard/index.html` contains all HTML, CSS, and JS
- Progressive enhancement: must work with JavaScript disabled for static content
- No external runtime dependencies — CDN scripts (Supabase JS) are the only allowed external load
- CSS uses custom properties (`var(--*)`) for the design system — no inline styles in new code
- Screen profiles are set via class on `<html>` (`screen-mobile`, `screen-laptop`, `screen-desktop`, `screen-ultrawide`)
- New features are added inside the existing script block — no separate `.js` files for the MVP dashboard

## Bridge (`bridge/`)

- **TypeScript strict mode** — `"strict": true` in tsconfig is non-negotiable
- ES Modules only (`"type": "module"` in package.json) — no CommonJS
- Node.js 20+ LTS — use native `node:fs/promises`, `node:crypto`, `node:path` — no polyfills
- Zero external network dependencies — the only outbound connection is to Supabase (optional)
- All modules export named exports — no default exports except for the main entry
- File naming: `camelCase.ts` for modules, matching the domain they serve
- One module per concern: `audit/`, `commands/`, `health/`, `security/`, `state/`, `supabase/`, `worktree/`
- Config is read once at startup from `config.json` — no runtime config reloads
- Main loop runs every 2 seconds (configurable) — operations: poll commands → execute → check health → write state

## React App (`app/`)

- **Vite + React 18 + TypeScript** — no Next.js, no SSR
- Tailwind CSS 4 with CSS custom properties — design tokens match the MVP dashboard palette exactly
- Zustand for client state — one store per domain (session, agent, kanban, cost, vps, auth)
- All Supabase calls go through `lib/supabase.ts` — no direct SDK calls in components
- Components are pure presentational or call hooks — no business logic in component bodies
- Hook naming: `use<Domain><Action>` (e.g., `useRealtimeAgents`, `useCostTracking`)
- File structure mirrors the component tree: `components/<domain>/<ComponentName>.tsx`
- No barrel `index.ts` files unless the directory has 4+ exports

## JSONL Audit Logs

- One JSON object per line, terminated by `\n`
- Timestamps in RFC 3339 format: `"2026-03-13T14:30:00.000Z"`
- Required fields on every entry: `{ ts, level, event, agentId?, sessionId?, data? }`
- Immutable once written — no log rotation that deletes entries; rotate by creating new files with date suffix
- Log file location: configurable via `config.json`, default `./logs/audit-<date>.jsonl`

## Filesystem IPC

- Bridge and dashboard communicate via JSON state files, never sockets or HTTP
- State file written by bridge: `<outputDir>/dashboard_state.json`
- Command files consumed by bridge: `<commandDir>/cmd-<timestamp>-<random>.json`
- Processed commands archived to `<commandDir>/archive/` — never deleted
- Dashboard polls state file as fallback when Supabase is unavailable

## Git Conventions

- Branch names: `feat/<feature>`, `fix/<bug>`, `chore/<task>`
- Commit format: conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- `bridge/dist/` is in `.gitignore` — never commit compiled output
- `app/dist/` is in `.gitignore` — Vercel builds from source
- `*.jsonl` log files are in `.gitignore` — never commit audit data
- `.env` files are in `.gitignore` at every level

## Error Handling

- Bridge operations use typed error classes where the error type informs retry behavior
- All async operations that touch the filesystem are wrapped in try/catch
- Errors are logged to the audit logger before being surfaced or swallowed
- No silent swallows: `catch (e) {}` is forbidden — minimum `console.error` + audit log entry
