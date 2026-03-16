# Hosted Solution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the single-file Agent Mission Control dashboard to a hosted Next.js + Supabase application accessible from any browser.

**Architecture:** Next.js 14 App Router frontend on Vercel, Supabase PostgreSQL + Realtime for persistence and live updates, Zustand for UI state. Claude Code hook pushes `agent_state.json` to a Supabase Edge Function via HTTP POST. Dashboard subscribes to changes via Supabase Realtime WebSocket.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Zustand, Supabase (PostgreSQL, Realtime, Edge Functions), Vercel

**Design Doc:** `docs/plans/2026-03-09-hosted-solution-design.md`

**Reference Implementation:** `index.html` (single-file dashboard with all features)

---

## Phase 1: Infrastructure

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `agent-mission-control/package.json`
- Create: `agent-mission-control/tsconfig.json`
- Create: `agent-mission-control/next.config.ts`
- Create: `agent-mission-control/tailwind.config.ts`
- Create: `agent-mission-control/postcss.config.mjs`
- Create: `agent-mission-control/src/app/layout.tsx`
- Create: `agent-mission-control/src/app/page.tsx`
- Create: `agent-mission-control/src/app/globals.css`

**Step 1: Create project directory and initialize**

```bash
cd "/Users/gregmorris/Development Projects/Claud_visualization"
npx create-next-app@latest agent-mission-control \
  --typescript --tailwind --eslint --app --src-dir \
  --no-turbopack --import-alias "@/*"
```

**Step 2: Install dependencies**

```bash
cd agent-mission-control
npm install @supabase/supabase-js zustand
npm install -D @types/node
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on localhost:3000 with default Next.js page.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, Zustand, Supabase deps"
```

---

### Task 2: Supabase Project + Database Schema

**Files:**
- Create: `agent-mission-control/supabase/migrations/001_initial_schema.sql`

**Step 1: Create Supabase project**

Use the Supabase MCP tools:
1. List organizations to find the user's org
2. Get cost for a new project
3. Confirm cost with user
4. Create project in preferred region

**Step 2: Write the migration SQL**

Create `agent-mission-control/supabase/migrations/001_initial_schema.sql`:

```sql
-- Sessions table: stores the full agent_state.json blob per session
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session events: append-only history for replay/audit
CREATE TABLE IF NOT EXISTS session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'state_update',
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast event queries by session
CREATE INDEX IF NOT EXISTS idx_session_events_session_id
  ON session_events(session_id);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_session_events_created_at
  ON session_events(created_at DESC);

-- Enable Realtime on sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- Auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Step 3: Apply migration via Supabase MCP**

Use `apply_migration` tool with the SQL above.

**Step 4: Verify tables exist**

Use `list_tables` tool to confirm `sessions` and `session_events` exist in public schema.

**Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with sessions, events, and realtime"
```

---

### Task 3: Supabase Edge Function — ingest-state

**Files:**
- Create: `agent-mission-control/supabase/functions/ingest-state/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ingest-state/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Validate required fields
    if (!body.project || !Array.isArray(body.agents)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project, agents" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Derive session_id from body or header
    const sessionId =
      body.session_id ||
      req.headers.get("x-session-id") ||
      body.project.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Upsert session
    const { error: upsertError } = await supabase.from("sessions").upsert(
      {
        id: sessionId,
        project: body.project,
        state: body,
      },
      { onConflict: "id" }
    );

    if (upsertError) throw upsertError;

    // Append to event history
    const { error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: sessionId,
        event_type: "state_update",
        payload: body,
      });

    if (eventError) throw eventError;

    return new Response(
      JSON.stringify({ ok: true, session_id: sessionId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

**Step 2: Deploy Edge Function via Supabase MCP**

Use `deploy_edge_function` tool with the code above. Set `verify_jwt: false` since we're using service_role key directly.

**Step 3: Test with curl**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ingest-state" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project":"test","agents":[],"tasks":[],"events":[]}'
```

Expected: `{"ok":true,"session_id":"test"}`

**Step 4: Verify data landed**

Use `execute_sql` tool:
```sql
SELECT id, project, updated_at FROM sessions WHERE id = 'test';
```

**Step 5: Clean up test data**

```sql
DELETE FROM session_events WHERE session_id = 'test';
DELETE FROM sessions WHERE id = 'test';
```

**Step 6: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add ingest-state Edge Function for data push"
```

---

### Task 4: Claude Code Push Hook Script

**Files:**
- Create: `agent-mission-control/scripts/push-state.sh`

**Step 1: Write the push script**

```bash
#!/usr/bin/env bash
# push-state.sh — Push agent_state.json to Supabase Edge Function
# Called by Claude Code postToolCall hook
#
# Required env vars:
#   AMC_API_URL           — Supabase Edge Function URL (e.g. https://xxx.supabase.co/functions/v1/ingest-state)
#   SUPABASE_SERVICE_ROLE_KEY — Service role key for auth
#
# Optional env vars:
#   AMC_SESSION_ID        — Override session ID (defaults to directory-derived slug)

set -euo pipefail

STATE_FILE="agent_state.json"

# Exit silently if no state file
[[ -f "$STATE_FILE" ]] || exit 0

# Exit silently if env not configured
[[ -n "${AMC_API_URL:-}" ]] || exit 0
[[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || exit 0

# Derive session ID from directory name if not set
SESSION_ID="${AMC_SESSION_ID:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')}"

# POST to Edge Function
curl -sS -X POST "$AMC_API_URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d @"$STATE_FILE" \
  --max-time 5 \
  > /dev/null 2>&1 || true
```

**Step 2: Make executable**

```bash
chmod +x scripts/push-state.sh
```

**Step 3: Test manually**

```bash
cd "/Users/gregmorris/Development Projects/Claud_visualization"
AMC_API_URL="$SUPABASE_URL/functions/v1/ingest-state" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  agent-mission-control/scripts/push-state.sh
```

Expected: Silent success. Verify with `execute_sql`:
```sql
SELECT id, project FROM sessions;
```

**Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add push-state.sh hook script for Claude Code integration"
```

---

## Phase 2: Foundation Code

### Task 5: TypeScript Types

**Files:**
- Create: `agent-mission-control/src/lib/types.ts`

**Step 1: Define all types**

```typescript
// src/lib/types.ts
// Mirror of agent_state.json schema + UI state

export type StageStatus = "completed" | "active" | "pending";
export type AgentType = "leader" | "backend" | "frontend" | "tester" | "reviewer";
export type AgentStatus = "working" | "thinking" | "idle" | "error" | "leader";
export type TaskStatus = "backlog" | "in-progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type EventType = "tool" | "file" | "task" | "message" | "thinking" | "error";
export type ScreenProfile = "laptop" | "desktop" | "ultrawide";
export type PaneView = "agents" | "kanban";

export interface Stage {
  name: string;
  desc?: string;
  status: StageStatus;
}

export interface AgentMetrics {
  ctx: string;
  cost: string;
  msgs: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  type: AgentType;
  status: AgentStatus;
  icon: string;
  task: string;
  taskId: string | null;
  metrics: AgentMetrics;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  deps?: string[];
  depOf?: string | null;
  rec: boolean;
  recWhy: string;
  _auto?: boolean;
  _prevSt?: TaskStatus | null;
}

export interface AgentEvent {
  agent: string;
  type: EventType;
  text: string;
  timestamp: string;
}

/** The full state blob pushed from Claude Code */
export interface SessionState {
  project: string;
  currentStageIdx: number;
  totalTasks: number;
  completedTasks: number;
  stages: Stage[];
  agents: Agent[];
  tasks: Task[];
  events: AgentEvent[];
}

/** A session row from the database */
export interface Session {
  id: string;
  project: string;
  state: SessionState;
  updated_at: string;
  created_at: string;
}

/** A single pane in the tiling manager */
export interface Pane {
  sid: string;
  view: PaneView;
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for session state, agents, tasks, events"
```

---

### Task 6: Constants + Design Tokens

**Files:**
- Create: `agent-mission-control/src/lib/constants.ts`
- Modify: `agent-mission-control/tailwind.config.ts`
- Modify: `agent-mission-control/src/app/globals.css`

**Step 1: Create constants**

```typescript
// src/lib/constants.ts
import type { TaskStatus } from "./types";

export const STAGES = [
  "Planning", "Scaffolding", "Core Logic", "API Layer",
  "Frontend", "Testing", "Integration", "Review",
] as const;

export const KANBAN_COLUMNS: TaskStatus[] = [
  "backlog", "in-progress", "review", "done",
];

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: "BACKLOG",
  "in-progress": "IN PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

export const ACCENT_CYCLE = [
  "cyan", "green", "amber", "violet", "blue", "rose",
] as const;

export const MAX_PANES: Record<string, number> = {
  laptop: 2,
  desktop: 3,
  ultrawide: 4,
};
```

**Step 2: Configure Tailwind with design tokens**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#06080c",
          1: "#0b0e14",
          2: "#10141c",
          3: "#161b26",
          4: "#1c2232",
          5: "#242b3d",
        },
        border: {
          1: "#1a2030",
          2: "#242e42",
          3: "#2e3a52",
        },
        text: {
          1: "#edf0f7",
          2: "#b0b8cc",
          3: "#6e7a94",
          4: "#3e4a64",
        },
        cyan: "#22d3ee",
        green: "#34d399",
        amber: "#fbbf24",
        red: "#f87171",
        violet: "#a78bfa",
        blue: "#60a5fa",
        rose: "#fb7185",
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
      fontSize: {
        xxs: "10px",
        xs: "11px",
        sm: "12px",
        base: "13px",
      },
      animation: {
        pulse: "pulse 2s infinite",
        "typing-dot": "typingDot 0.8s infinite",
        "feed-in": "feedIn 0.3s ease-out",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        typingDot: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "1" },
        },
        feedIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 3: Write globals.css**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-font-smoothing: antialiased; }

body {
  background: #06080c;
  color: #edf0f7;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Scanline overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0,0,0,.03) 2px, rgba(0,0,0,.03) 4px
  );
}

/* Custom scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #242e42; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #2e3a52; }

/* Screen density profiles */
:root {
  --density-pad: 16px;
  --density-gap: 12px;
  --pane-min: 420px;
  --topbar-h: 48px;
}
.screen-laptop {
  --density-pad: 12px;
  --density-gap: 8px;
  --pane-min: 360px;
  --topbar-h: 40px;
}
.screen-ultrawide {
  --density-pad: 20px;
  --density-gap: 16px;
  --pane-min: 480px;
  --topbar-h: 52px;
}
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/lib/constants.ts tailwind.config.ts src/app/globals.css
git commit -m "feat: add design tokens, constants, and global styles"
```

---

### Task 7: Supabase Client + Realtime Hook

**Files:**
- Create: `agent-mission-control/src/lib/supabase/client.ts`
- Create: `agent-mission-control/src/lib/supabase/use-sessions.ts`
- Create: `agent-mission-control/.env.local` (gitignored)

**Step 1: Create browser Supabase client**

```typescript
// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Create Realtime sessions hook**

```typescript
// src/lib/supabase/use-sessions.ts
"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./client";
import { useUIStore } from "@/stores/ui-store";
import type { Session } from "@/lib/types";

/** Fetch all sessions on mount, then subscribe to Realtime changes */
export function useSessionSync() {
  const setSessions = useUIStore((s) => s.setSessions);
  const upsertSession = useUIStore((s) => s.upsertSession);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Initial fetch
    async function load() {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setSessions(data as Session[]);
      }
    }
    load();

    // Realtime subscription
    const channel = supabase
      .channel("sessions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            upsertSession(payload.new as Session);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [setSessions, upsertSession]);
}
```

**Step 3: Create .env.local**

```bash
# .env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Get the actual values from Supabase MCP `get_project_url` and `get_publishable_keys`.

**Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client and realtime sessions hook"
```

---

### Task 8: Zustand UI Store

**Files:**
- Create: `agent-mission-control/src/stores/ui-store.ts`

**Step 1: Write the store**

```typescript
// src/stores/ui-store.ts
"use client";

import { create } from "zustand";
import type { Session, Pane, ScreenProfile, PaneView, TaskStatus, Task } from "@/lib/types";
import { MAX_PANES } from "@/lib/constants";

interface UIState {
  // Sessions from Supabase
  sessions: Record<string, Session>;
  order: string[];
  active: string;

  // Layout
  screen: ScreenProfile;
  tiles: number;
  panes: Pane[];

  // Feed
  feedFilter: string;

  // Actions — sessions
  setSessions: (sessions: Session[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (sid: string) => void;
  setActive: (sid: string) => void;

  // Actions — layout
  setScreen: (profile: ScreenProfile) => void;
  setTiles: (n: number) => void;
  setPaneSession: (idx: number, sid: string) => void;
  setPaneView: (idx: number, view: PaneView) => void;

  // Actions — feed
  setFeedFilter: (filter: string) => void;

  // Actions — task approval
  approveTask: (sessionId: string, taskId: string) => void;
  rejectTask: (sessionId: string, taskId: string) => void;

  // Actions — drag
  moveTask: (sessionId: string, taskId: string, newStatus: TaskStatus) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sessions: {},
  order: [],
  active: "",
  screen: "desktop",
  tiles: 1,
  panes: [{ sid: "", view: "agents" }],
  feedFilter: "all",

  setSessions: (sessions) => {
    const map: Record<string, Session> = {};
    const order: string[] = [];
    sessions.forEach((s) => {
      map[s.id] = s;
      order.push(s.id);
    });
    const active = order[0] || "";
    set({
      sessions: map,
      order,
      active,
      panes: [{ sid: active, view: "agents" }],
    });
  },

  upsertSession: (session) => {
    const { sessions, order, active, panes } = get();
    const newSessions = { ...sessions, [session.id]: session };
    const newOrder = order.includes(session.id)
      ? order
      : [...order, session.id];
    const newActive = active || session.id;
    const newPanes = panes.map((p) =>
      p.sid === "" ? { ...p, sid: newActive } : p
    );
    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      panes: newPanes,
    });
  },

  removeSession: (sid) => {
    const { sessions, order, active, panes } = get();
    if (order.length <= 1) return;
    const newSessions = { ...sessions };
    delete newSessions[sid];
    const newOrder = order.filter((id) => id !== sid);
    const newActive = active === sid ? newOrder[0] : active;
    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      panes: panes.map((p) =>
        p.sid === sid ? { ...p, sid: newActive } : p
      ),
    });
  },

  setActive: (sid) => set({ active: sid }),

  setScreen: (profile) => {
    const maxP = MAX_PANES[profile] || 3;
    const { tiles, panes } = get();
    const newTiles = Math.min(tiles, maxP);
    set({
      screen: profile,
      tiles: newTiles,
      panes: panes.slice(0, newTiles),
    });
  },

  setTiles: (n) => {
    const { screen, panes, active } = get();
    const max = MAX_PANES[screen] || 3;
    const clamped = Math.min(n, max);
    const newPanes = [...panes];
    while (newPanes.length < clamped) {
      newPanes.push({ sid: active, view: "agents" });
    }
    set({ tiles: clamped, panes: newPanes.slice(0, clamped) });
  },

  setPaneSession: (idx, sid) => {
    const panes = [...get().panes];
    if (panes[idx]) panes[idx] = { ...panes[idx], sid };
    set({ panes });
  },

  setPaneView: (idx, view) => {
    const panes = [...get().panes];
    if (panes[idx]) panes[idx] = { ...panes[idx], view };
    set({ panes });
  },

  setFeedFilter: (filter) => set({ feedFilter: filter }),

  approveTask: (sessionId, taskId) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, rec: false, recWhy: "", _auto: false, _prevSt: null, depOf: null } : t
    );
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },

  rejectTask: (sessionId, taskId) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) => {
      if (t.id !== taskId) return t;
      // Revert to previous status if auto-detected transition
      const revertStatus = t._prevSt || "backlog";
      return { ...t, status: revertStatus, rec: false, recWhy: "", _auto: false, _prevSt: null, depOf: null };
    });
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },

  moveTask: (sessionId, taskId, newStatus) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },
}));
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/stores/ui-store.ts
git commit -m "feat: add Zustand UI store with session, layout, approval, and drag actions"
```

---

## Phase 3: Layout Components

### Task 9: Root Layout + Fonts

**Files:**
- Modify: `agent-mission-control/src/app/layout.tsx`

**Step 1: Set up layout with Geist fonts**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Mission Control",
  description: "Real-time dashboard for monitoring Claude Code agent teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

**Step 2: Install geist font package**

```bash
npm install geist
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: add root layout with Geist fonts"
```

---

### Task 10: TopBar Component

**Files:**
- Create: `agent-mission-control/src/components/top-bar/top-bar.tsx`
- Create: `agent-mission-control/src/components/top-bar/session-tabs.tsx`
- Create: `agent-mission-control/src/components/top-bar/screen-picker.tsx`
- Create: `agent-mission-control/src/components/top-bar/tile-picker.tsx`
- Create: `agent-mission-control/src/components/top-bar/clock.tsx`
- Create: `agent-mission-control/src/components/top-bar/index.ts`

**Step 1: Create Clock**

```tsx
// src/components/top-bar/clock.tsx
"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-xs text-text-3 whitespace-nowrap">
      <span className="text-green animate-pulse">•</span>
      <span className="text-green">LIVE</span>
      <span>{time}</span>
    </div>
  );
}
```

**Step 2: Create ScreenPicker**

```tsx
// src/components/top-bar/screen-picker.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import type { ScreenProfile } from "@/lib/types";

const PROFILES: { label: string; value: ScreenProfile }[] = [
  { label: '14"', value: "laptop" },
  { label: '27"', value: "desktop" },
  { label: '49"', value: "ultrawide" },
];

export function ScreenPicker() {
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);

  return (
    <div className="flex gap-1">
      {PROFILES.map((p) => (
        <button
          key={p.value}
          onClick={() => setScreen(p.value)}
          className={`px-2 py-1 rounded text-xxs font-mono border transition-all cursor-pointer ${
            screen === p.value
              ? "text-cyan border-border-2 bg-bg-3"
              : "text-text-4 border-transparent hover:text-text-3"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Create TilePicker**

```tsx
// src/components/top-bar/tile-picker.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import { MAX_PANES } from "@/lib/constants";

const TILE_ICONS = ["|", "||", "|||", "||||"];

export function TilePicker() {
  const screen = useUIStore((s) => s.screen);
  const tiles = useUIStore((s) => s.tiles);
  const setTiles = useUIStore((s) => s.setTiles);
  const max = MAX_PANES[screen] || 3;

  return (
    <div className="flex gap-1">
      {TILE_ICONS.slice(0, max).map((icon, i) => (
        <button
          key={i}
          onClick={() => setTiles(i + 1)}
          className={`px-2 py-1 rounded text-xxs font-mono border transition-all cursor-pointer ${
            tiles === i + 1
              ? "text-cyan border-border-2 bg-bg-3"
              : "text-text-4 border-transparent hover:text-text-3"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Create SessionTabs**

```tsx
// src/components/top-bar/session-tabs.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import { ACCENT_CYCLE } from "@/lib/constants";

export function SessionTabs() {
  const order = useUIStore((s) => s.order);
  const active = useUIStore((s) => s.active);
  const sessions = useUIStore((s) => s.sessions);
  const setActive = useUIStore((s) => s.setActive);
  const removeSession = useUIStore((s) => s.removeSession);

  return (
    <div className="flex gap-1 flex-1 overflow-x-auto min-w-0">
      {order.map((sid, i) => {
        const sess = sessions[sid];
        if (!sess) return null;
        const isActive = sid === active;
        const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];

        return (
          <button
            key={sid}
            onClick={() => setActive(sid)}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-md font-mono text-xs whitespace-nowrap transition-all border cursor-pointer ${
              isActive
                ? `text-cyan bg-bg-3 border-border-2 shadow-[0_0_8px_rgba(34,211,238,.1)]`
                : "text-text-3 bg-transparent border-transparent hover:text-text-2 hover:bg-bg-3"
            }`}
          >
            <span className={`text-${accent}`}>●</span>
            <span>{sess.project}</span>
            {order.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(sid);
                }}
                className="hidden group-hover:inline-flex ml-1 text-[10px] text-text-4 hover:text-red hover:bg-red/15 px-0.5 rounded cursor-pointer"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 5: Compose TopBar**

```tsx
// src/components/top-bar/top-bar.tsx
"use client";

import { SessionTabs } from "./session-tabs";
import { ScreenPicker } from "./screen-picker";
import { TilePicker } from "./tile-picker";
import { Clock } from "./clock";

export function TopBar() {
  return (
    <header
      className="h-[var(--topbar-h)] bg-bg-1 border-b border-border-1 flex items-center px-[var(--density-pad)] gap-[var(--density-gap)] sticky top-0 z-50"
    >
      <div className="flex items-center gap-2 font-mono font-bold text-sm text-cyan tracking-wider whitespace-nowrap">
        <span className="text-[1.2em]">◊</span>
        <span>MISSION CONTROL</span>
      </div>
      <SessionTabs />
      <ScreenPicker />
      <TilePicker />
      <Clock />
    </header>
  );
}
```

**Step 6: Create barrel export**

```typescript
// src/components/top-bar/index.ts
export { TopBar } from "./top-bar";
```

**Step 7: Verify build**

```bash
npm run build
```

**Step 8: Commit**

```bash
git add src/components/top-bar/
git commit -m "feat: add TopBar with session tabs, screen/tile pickers, clock"
```

---

### Task 11: TilingManager + Pane Shell

**Files:**
- Create: `agent-mission-control/src/components/tiling/tiling-manager.tsx`
- Create: `agent-mission-control/src/components/tiling/pane.tsx`
- Create: `agent-mission-control/src/components/tiling/index.ts`

**Step 1: Create Pane**

```tsx
// src/components/tiling/pane.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import type { PaneView } from "@/lib/types";
import { AgentView } from "@/components/agent-view";
import { KanbanBoard } from "@/components/kanban";

interface PaneProps {
  index: number;
}

export function Pane({ index }: PaneProps) {
  const pane = useUIStore((s) => s.panes[index]);
  const sessions = useUIStore((s) => s.sessions);
  const order = useUIStore((s) => s.order);
  const setPaneSession = useUIStore((s) => s.setPaneSession);
  const setPaneView = useUIStore((s) => s.setPaneView);

  if (!pane) return null;
  const session = sessions[pane.sid];

  return (
    <div className="flex-1 min-w-[var(--pane-min)] flex flex-col border-r border-border-1 last:border-r-0 overflow-hidden">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-1 border-b border-border-1">
        <select
          value={pane.sid}
          onChange={(e) => setPaneSession(index, e.target.value)}
          className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer"
        >
          {order.map((sid) => (
            <option key={sid} value={sid}>
              {sessions[sid]?.project || sid}
            </option>
          ))}
        </select>
        <select
          value={pane.view}
          onChange={(e) => setPaneView(index, e.target.value as PaneView)}
          className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer"
        >
          <option value="agents">Agent View</option>
          <option value="kanban">Kanban Board</option>
        </select>
      </div>

      {/* Pane body */}
      <div className="flex-1 overflow-y-auto p-[var(--density-pad)]">
        {session ? (
          pane.view === "agents" ? (
            <AgentView session={session} />
          ) : (
            <KanbanBoard session={session} />
          )
        ) : (
          <div className="text-text-4 text-sm text-center mt-8">
            No session selected
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create TilingManager**

```tsx
// src/components/tiling/tiling-manager.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import { Pane } from "./pane";

export function TilingManager() {
  const tiles = useUIStore((s) => s.tiles);

  return (
    <main className="flex flex-1 overflow-hidden">
      {Array.from({ length: tiles }, (_, i) => (
        <Pane key={i} index={i} />
      ))}
    </main>
  );
}
```

**Step 3: Create barrel export**

```typescript
// src/components/tiling/index.ts
export { TilingManager } from "./tiling-manager";
```

**Step 4: Commit**

```bash
git add src/components/tiling/
git commit -m "feat: add TilingManager with per-pane session/view selectors"
```

---

## Phase 4: View Components

### Task 12: ProgressRing (SVG)

**Files:**
- Create: `agent-mission-control/src/components/agent-view/progress-ring.tsx`

**Step 1: Create the SVG progress ring component**

```tsx
// src/components/agent-view/progress-ring.tsx
interface ProgressRingProps {
  percent: number;
  size?: number;
}

export function ProgressRing({ percent, size = 56 }: ProgressRingProps) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#1a2030"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#edf0f7"
        fontSize="12"
        fontFamily="var(--font-geist-mono)"
        className="rotate-90 origin-center"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agent-view/progress-ring.tsx
git commit -m "feat: add ProgressRing SVG component"
```

---

### Task 13: PipelineStages

**Files:**
- Create: `agent-mission-control/src/components/agent-view/pipeline-stages.tsx`

**Step 1: Create stage pills**

```tsx
// src/components/agent-view/pipeline-stages.tsx
import type { Stage } from "@/lib/types";

interface PipelineStagesProps {
  stages: Stage[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "border-green text-green bg-green/10",
  active: "border-cyan text-cyan bg-cyan/10",
  pending: "border-border-2 text-text-4 bg-transparent",
};

export function PipelineStages({ stages }: PipelineStagesProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {stages.map((stage) => (
        <span
          key={stage.name}
          className={`px-3 py-1 rounded-full text-xxs font-mono border whitespace-nowrap shrink-0 ${
            STATUS_COLORS[stage.status] || STATUS_COLORS.pending
          } ${stage.status === "active" ? "animate-pulse" : ""}`}
        >
          {stage.name}
        </span>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agent-view/pipeline-stages.tsx
git commit -m "feat: add PipelineStages component with status pills"
```

---

### Task 14: AgentCard + Grid

**Files:**
- Create: `agent-mission-control/src/components/agent-view/agent-card.tsx`

**Step 1: Create AgentCard**

```tsx
// src/components/agent-view/agent-card.tsx
import type { Agent } from "@/lib/types";

interface AgentCardProps {
  agent: Agent;
  taskTitle?: string;
}

const STATUS_BORDER: Record<string, string> = {
  working: "border-l-cyan",
  thinking: "border-l-violet",
  idle: "border-l-text-4",
  error: "border-l-red",
  leader: "border-l-amber",
};

export function AgentCard({ agent, taskTitle }: AgentCardProps) {
  const m = agent.metrics;

  return (
    <div
      className={`bg-bg-2 rounded-lg p-[var(--density-pad)] border border-border-1 border-l-2 ${
        STATUS_BORDER[agent.status] || "border-l-text-4"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{agent.icon}</span>
          <div>
            <div className="text-xs font-mono text-text-1 font-semibold">
              {agent.name}
            </div>
            <div className="text-xxs text-text-3">{agent.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`text-xxs font-mono px-1.5 py-0.5 rounded-full border ${
              STATUS_BORDER[agent.status]?.replace("border-l-", "text-") || "text-text-4"
            } border-current/30 bg-current/5`}
          >
            {agent.status}
          </span>
          {(agent.status === "working" || agent.status === "thinking") && (
            <span className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-current animate-typing-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-text-2 mb-2 truncate">
        {taskTitle || agent.task}
      </div>

      <div className="flex gap-3 text-xxs text-text-3 font-mono">
        <span>CTX {m.ctx}</span>
        <span>{m.cost}</span>
        <span>{m.msgs} msgs</span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agent-view/agent-card.tsx
git commit -m "feat: add AgentCard with status indicator, metrics, typing dots"
```

---

### Task 15: ActivityFeed

**Files:**
- Create: `agent-mission-control/src/components/agent-view/activity-feed.tsx`

**Step 1: Create activity feed with filters**

```tsx
// src/components/agent-view/activity-feed.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import type { AgentEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: AgentEvent[];
}

const FILTERS = ["all", "tool", "file", "task", "message", "error"] as const;

const TYPE_COLORS: Record<string, string> = {
  tool: "text-cyan",
  file: "text-green",
  task: "text-amber",
  message: "text-blue",
  thinking: "text-violet",
  error: "text-red",
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  const feedFilter = useUIStore((s) => s.feedFilter);
  const setFeedFilter = useUIStore((s) => s.setFeedFilter);

  const filtered =
    feedFilter === "all"
      ? events
      : events.filter((e) => e.type === feedFilter);

  const display = filtered.slice(-30).reverse();

  return (
    <div className="mt-[var(--density-gap)]">
      <div className="flex items-center justify-between mb-2 font-mono text-xs text-text-3">
        <span>ACTIVITY</span>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFeedFilter(f)}
              className={`px-2 py-0.5 rounded text-xxs font-mono cursor-pointer transition-colors ${
                feedFilter === f
                  ? "text-cyan bg-cyan/10"
                  : "text-text-4 hover:text-text-3"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
        {display.map((ev, i) => (
          <div
            key={`${ev.timestamp}-${i}`}
            className="flex gap-2 px-2 py-1 rounded text-xs animate-feed-in"
          >
            <span className="font-mono text-xxs text-text-4 whitespace-nowrap min-w-[55px]">
              {ev.timestamp}
            </span>
            <span
              className={`font-mono text-xxs whitespace-nowrap min-w-[80px] overflow-hidden text-ellipsis ${
                TYPE_COLORS[ev.type] || "text-cyan"
              }`}
            >
              {ev.agent}
            </span>
            <span className="text-text-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {ev.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agent-view/activity-feed.tsx
git commit -m "feat: add ActivityFeed with type filters and color-coded events"
```

---

### Task 16: AgentView (composition)

**Files:**
- Create: `agent-mission-control/src/components/agent-view/agent-view.tsx`
- Create: `agent-mission-control/src/components/agent-view/index.ts`

**Step 1: Compose AgentView from sub-components**

```tsx
// src/components/agent-view/agent-view.tsx
import type { Session } from "@/lib/types";
import { ProgressRing } from "./progress-ring";
import { PipelineStages } from "./pipeline-stages";
import { AgentCard } from "./agent-card";
import { ActivityFeed } from "./activity-feed";

interface AgentViewProps {
  session: Session;
}

export function AgentView({ session }: AgentViewProps) {
  const s = session.state;
  const pct = s.totalTasks > 0 ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;

  // Resolve taskId → task title for agent cards
  const taskMap = new Map(s.tasks.map((t) => [t.id, t.title]));

  return (
    <div>
      {/* Build banner */}
      <div className="flex items-center gap-4 mb-4 bg-bg-2 rounded-lg p-4 border border-border-1">
        <ProgressRing percent={pct} />
        <div>
          <div className="text-sm font-mono text-text-1 font-semibold">
            {s.project}
          </div>
          <div className="text-xs text-text-3">
            Stage {s.currentStageIdx + 1}/{s.stages.length} • {s.completedTasks}/
            {s.totalTasks} tasks
          </div>
        </div>
      </div>

      {/* Pipeline stages */}
      <PipelineStages stages={s.stages} />

      {/* Agent cards grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[var(--density-gap)] mt-[var(--density-gap)]">
        {s.agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            taskTitle={agent.taskId ? taskMap.get(agent.taskId) : undefined}
          />
        ))}
      </div>

      {/* Activity feed */}
      <ActivityFeed events={s.events} />
    </div>
  );
}
```

**Step 2: Create barrel export**

```typescript
// src/components/agent-view/index.ts
export { AgentView } from "./agent-view";
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/agent-view/
git commit -m "feat: add AgentView composing ring, stages, cards, and feed"
```

---

### Task 17: KanbanCard + Approval Badges

**Files:**
- Create: `agent-mission-control/src/components/kanban/kanban-card.tsx`

**Step 1: Create KanbanCard with approval system**

```tsx
// src/components/kanban/kanban-card.tsx
"use client";

import { useUIStore } from "@/stores/ui-store";
import type { Task, Agent } from "@/lib/types";

interface KanbanCardProps {
  task: Task;
  sessionId: string;
  activeAgent?: Agent;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red",
  medium: "bg-amber",
  low: "bg-green",
};

export function KanbanCard({ task, sessionId, activeAgent }: KanbanCardProps) {
  const approveTask = useUIStore((s) => s.approveTask);
  const rejectTask = useUIStore((s) => s.rejectTask);

  const isRec = task.rec && !task._auto;
  const isTrans = task.rec && task._auto;
  const isDep = !!task.depOf;
  const isAgentActive = !!activeAgent;

  let borderClass = "border-border-1";
  if (isRec) borderClass = "border-violet shadow-[0_0_12px_rgba(167,139,250,.15)]";
  else if (isTrans) borderClass = "border-blue shadow-[0_0_12px_rgba(96,165,250,.15)]";
  else if (isDep) borderClass = "border-amber";
  if (isAgentActive) borderClass += " border-l-2 border-l-cyan";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`bg-bg-2 rounded-lg p-3 border cursor-grab hover:-translate-y-px transition-transform ${borderClass}`}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />
        <span className="text-xs text-text-1 font-mono leading-tight">{task.title}</span>
      </div>

      {/* Assignee */}
      <div className="text-xxs text-text-3 mb-1">{task.assignee}</div>

      {/* Active agent indicator */}
      {isAgentActive && activeAgent && (
        <div className="flex items-center gap-1 text-xxs text-cyan mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse-dot" />
          <span className="font-mono">{activeAgent.name}</span>
        </div>
      )}

      {/* Recommendation / Transition badge */}
      {isRec && (
        <div className="mt-2 p-2 rounded bg-violet/10 border border-violet/30">
          <div className="text-xxs text-violet font-mono mb-1">PERMISSION REQUEST</div>
          <div className="text-xxs text-text-2 mb-2">{task.recWhy}</div>
          <div className="flex gap-2">
            <button
              onClick={() => approveTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-green/20 text-green border border-green/30 hover:bg-green/30 cursor-pointer"
            >
              Allow
            </button>
            <button
              onClick={() => rejectTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-red/20 text-red border border-red/30 hover:bg-red/30 cursor-pointer"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {isTrans && (
        <div className="mt-2 p-2 rounded bg-blue/10 border border-blue/30">
          <div className="text-xxs text-blue font-mono mb-1">STATUS CHANGE</div>
          <div className="text-xxs text-text-2 mb-2">{task.recWhy}</div>
          <div className="flex gap-2">
            <button
              onClick={() => approveTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-green/20 text-green border border-green/30 hover:bg-green/30 cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => rejectTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-amber/20 text-amber border border-amber/30 hover:bg-amber/30 cursor-pointer"
            >
              Revert
            </button>
          </div>
        </div>
      )}

      {isDep && !isRec && !isTrans && (
        <div className="mt-2 p-1.5 rounded bg-amber/10 border border-amber/30">
          <div className="text-xxs text-amber font-mono">
            DEP: Required by {task.depOf}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/kanban/kanban-card.tsx
git commit -m "feat: add KanbanCard with drag, approval badges, agent indicator"
```

---

### Task 18: KanbanColumn + Drag-Drop

**Files:**
- Create: `agent-mission-control/src/components/kanban/kanban-column.tsx`

**Step 1: Create KanbanColumn with HTML5 drag-and-drop**

```tsx
// src/components/kanban/kanban-column.tsx
"use client";

import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import { COLUMN_LABELS } from "@/lib/constants";
import { KanbanCard } from "./kanban-card";
import type { Task, TaskStatus, Agent } from "@/lib/types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  sessionId: string;
  agents: Agent[];
}

export function KanbanColumn({ status, tasks, sessionId, agents }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const moveTask = useUIStore((s) => s.moveTask);

  // Build agent map by taskId
  const agentByTask = new Map<string, Agent>();
  agents.forEach((a) => {
    if (a.taskId) agentByTask.set(a.taskId, a);
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTask(sessionId, taskId, status);
    }
  }

  return (
    <div
      className={`flex-shrink-0 w-[var(--kb-col-w,280px)] flex flex-col rounded-lg border transition-colors ${
        dragOver
          ? "border-cyan/50 bg-cyan/5"
          : "border-border-1 bg-bg-1"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-1">
        <span className="text-xxs font-mono text-text-3 tracking-wider">
          {COLUMN_LABELS[status]}
        </span>
        <span className="text-xxs font-mono text-text-4 bg-bg-3 px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            sessionId={sessionId}
            activeAgent={agentByTask.get(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/kanban/kanban-column.tsx
git commit -m "feat: add KanbanColumn with HTML5 drag-and-drop zones"
```

---

### Task 19: KanbanBoard (composition)

**Files:**
- Create: `agent-mission-control/src/components/kanban/kanban-board.tsx`
- Create: `agent-mission-control/src/components/kanban/index.ts`

**Step 1: Compose KanbanBoard**

```tsx
// src/components/kanban/kanban-board.tsx
import type { Session } from "@/lib/types";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  session: Session;
}

export function KanbanBoard({ session }: KanbanBoardProps) {
  const s = session.state;

  return (
    <div className="flex gap-[var(--density-gap)] overflow-x-auto pb-2 h-full">
      {KANBAN_COLUMNS.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={s.tasks.filter((t) => t.status === status)}
          sessionId={session.id}
          agents={s.agents}
        />
      ))}
    </div>
  );
}
```

**Step 2: Create barrel export**

```typescript
// src/components/kanban/index.ts
export { KanbanBoard } from "./kanban-board";
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/kanban/
git commit -m "feat: add KanbanBoard composing columns with drag-and-drop"
```

---

## Phase 5: Integration + Deploy

### Task 20: Wire Main Page

**Files:**
- Modify: `agent-mission-control/src/app/page.tsx`

**Step 1: Wire all components into the main page**

```tsx
// src/app/page.tsx
"use client";

import { TopBar } from "@/components/top-bar";
import { TilingManager } from "@/components/tiling";
import { useSessionSync } from "@/lib/supabase/use-sessions";

export default function Home() {
  useSessionSync();

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <TilingManager />
    </div>
  );
}
```

**Step 2: Verify dev server works end-to-end**

```bash
npm run dev
```

Navigate to localhost:3000. Expected: Empty dashboard with TopBar (no sessions yet).

**Step 3: Push test data via the hook script or curl**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ingest-state" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d @"/Users/gregmorris/Development Projects/Claud_visualization/agent_state.json"
```

Expected: Dashboard auto-updates via Realtime showing CE Africa Valuation Platform with agents, pipeline, Kanban, and activity feed.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire main page with TopBar, TilingManager, and Realtime sync"
```

---

### Task 21: Health Check API Route

**Files:**
- Create: `agent-mission-control/src/app/api/health/route.ts`

**Step 1: Create health endpoint**

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
```

**Step 2: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add /api/health endpoint"
```

---

### Task 22: Deploy to Vercel

**Step 1: Verify build passes**

```bash
cd agent-mission-control
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Deploy via Vercel MCP**

Use `deploy_to_vercel` tool from the `agent-mission-control/` directory.

**Step 3: Set environment variables**

In Vercel project settings, add:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project

**Step 4: Verify deployment**

Visit the Vercel deployment URL. Expected: Dashboard loads and connects to Supabase Realtime.

**Step 5: Push real data**

```bash
AMC_API_URL="$SUPABASE_URL/functions/v1/ingest-state" \
  SUPABASE_SERVICE_ROLE_KEY="$KEY" \
  ./scripts/push-state.sh
```

Expected: Dashboard updates in real-time.

**Step 6: Commit any final changes**

```bash
git add -A
git commit -m "feat: deploy to Vercel with Supabase integration"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Infrastructure | 1-4 | Next.js scaffold, Supabase schema, Edge Function, push hook |
| 2. Foundation | 5-8 | Types, constants, design tokens, Supabase client, Zustand store |
| 3. Layout | 9-11 | Root layout, TopBar, TilingManager |
| 4. Views | 12-19 | ProgressRing, PipelineStages, AgentCard, ActivityFeed, KanbanBoard |
| 5. Integration | 20-22 | Wire page, health check, deploy to Vercel |

Total: **22 tasks** across 5 phases.
