# Review Gate Extensions — Agent Mission Control

These rules extend the global review gate for this project's specific architecture.
Check ALL of the following on every task completion, before marking done.

---

## Dashboard (vanilla HTML/CSS/JS)

### No inline credentials
- FAIL if `SUPABASE_URL` or `SUPABASE_ANON_KEY` (or any key matching `/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/`) is hardcoded in `dashboard/index.html`
- Keys must come from a config block the user edits, with a clear `// TODO: replace with your values` comment — NOT committed values
- The existing hardcoded values in `dashboard/index.html` lines 478-479 are known and grandfathered for the MVP; the React app (`app/`) must use `.env` only

### No hardcoded URLs
- No absolute URLs hardcoded in JS outside of the user-editable config block
- Supabase project URL (`zpsnbogldtepmfwgqarz.supabase.co`) must not appear in source outside the config section

### Realtime error handling
- Every `supabase.channel(...).subscribe(...)` call must handle the `SUBSCRIPTION_ERROR` status
- Subscriptions must attempt reconnection on drop — no fire-and-forget subscriptions

---

## Bridge (Node.js / TypeScript)

### Zero network listeners — NON-NEGOTIABLE
- FAIL immediately if any of these appear in `bridge/src/`:
  - `http.createServer`
  - `https.createServer`
  - `express()`
  - `fastify()`
  - `net.createServer`
  - `net.listen`
  - `app.listen`
  - `server.listen`
- The bridge communicates ONLY via filesystem IPC and Supabase push. No HTTP server, ever.

### Filesystem error handling
- All `fs`/`fs/promises` operations must handle at minimum: `ENOENT`, `EACCES`, `EISDIR`
- File watchers (`chokidar`) must handle `error` events — never leave an `.on('error')` unset
- Race conditions: when reading a file that another process may be writing, use retry-with-backoff or lock files, not bare reads

### Audit log integrity
- `bridge/src/audit/logger.ts` must only ever use `appendFile` — NEVER `writeFile`, `createWriteStream` without `flags: 'a'`, or any truncating write
- No code path in the bridge may delete, truncate, or overwrite an audit log file
- FAIL if `unlink`, `rm`, `truncate`, or `writeFile` target a path containing `audit` or matching `*.jsonl`

### Session token security
- Token generation must use `crypto.randomBytes(32).toString('hex')` — NEVER `Math.random()`, `Date.now()`, or `uuid()` without crypto backing
- Tokens must be validated against the stored value using constant-time comparison where possible

### Agent spawning and lifecycle
- Every spawned Claude Code process must be registered in the agent registry before `spawn()` returns
- PID must be stored and monitored — no fire-and-forget spawns
- On bridge shutdown (SIGINT/SIGTERM), all child processes must be terminated — no orphaned agents
- Each agent is isolated to its own git worktree — never share a worktree between two concurrent agents

### Atomic file writes (JSON state files)
- State files written by the bridge (`dashboard_state.json`, `agent_state.json`, etc.) must use atomic write pattern: write to `<file>.tmp`, then `rename` to final path
- Never write partial JSON to a file that the dashboard may be reading concurrently

---

## Supabase / Database

### RLS on all tables
- Every table in the schema must have RLS enabled
- No table may have an `allow all` policy without a session/user filter
- Policies must filter by `auth.uid()` or a session token joined to `profiles`

### No service key in client code
- The `service_role` key must NEVER appear in `dashboard/`, `app/`, or `bridge/src/`
- Service key usage is only permitted in Supabase Edge Functions or server-side admin scripts

### Kanban state machine
- Task state transitions must be validated: valid transitions are `backlog → todo → in_progress → review → done` and `* → blocked`
- No code may move a task from `backlog` directly to `done` without passing through required gates
- Approval-gated tasks must go through the approval queue — no UI shortcut that bypasses it

---

## React Dashboard (`app/`)

### Env vars only
- `app/.env` must be in `.gitignore`
- All Supabase credentials in `app/` must come from `import.meta.env.VITE_*` — no hardcoded strings
- `app/.env.example` must exist and list all required variables without real values

### Auth guard
- Every route except `/login` must be wrapped in `AuthGuard`
- Unauthenticated users must be redirected to login, never shown partial data

### No direct DB calls from components
- Components must call stores or hooks — never call `supabase.from(...)` directly in a component body
- All Supabase queries live in `lib/` or `hooks/`

---

## Multi-VPS Readiness

- No hardcoded `localhost` or `127.0.0.1` in IPC paths, data directories, or connection strings
- All configurable paths must be read from `config.json` or environment variables
- VPS node identity must come from config, not from hostname detection or hardcoded values

---

## Tooling Commands (run after every task)

```bash
# Bridge — type check
cd bridge && npx tsc --noEmit

# Bridge — network listener audit
grep -r "http.createServer\|net.listen\|express()\|fastify\|app.listen" bridge/src/ && echo "FAIL: network listener found" || echo "PASS"

# Audit log safety check
grep -r "writeFile\|unlink\|truncate" bridge/src/audit/ && echo "FAIL: destructive audit op" || echo "PASS"

# React app — type check (when app/ exists)
cd app && npx tsc --noEmit

# React app — env check
grep -r "eyJ\|supabase.co" app/src/ && echo "FAIL: hardcoded credentials" || echo "PASS"
```
