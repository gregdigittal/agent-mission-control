/**
 * Typed REST API client for the Agent Mission Control dashboard.
 *
 * This module is used by the browser dashboard — not by serverless functions.
 * It reads VITE_API_BASE_URL for the base URL (defaults to '' = same origin).
 *
 * Auth token is read from VITE_API_TOKEN if present (useful for local dev
 * or CI scripts that call the API directly from a browser context).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpawnSessionOpts {
  objective: string;
  repoPath: string;
  model?: string;
  maxTurns?: number;
}

export interface SpawnSessionResult {
  sessionId: string;
  commandId: string;
  status: 'queued';
}

/** Matches the agent_sessions row shape returned by GET /api/sessions/:id */
export interface SessionState {
  id: string;
  [key: string]: unknown;
}

export interface CreateTaskOpts {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface CreateTaskResult {
  taskId: string;
  commandId: string;
  status: 'queued';
}

// ─── Client internals ───────────────────────────────────────────────────────

function getBaseUrl(): string {
  return import.meta.env['VITE_API_BASE_URL'] ?? '';
}

function getApiToken(): string | undefined {
  return import.meta.env['VITE_API_TOKEN'] as string | undefined;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getBaseUrl();
  const token = getApiToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json() as { error?: string };
      if (typeof body.error === 'string') detail = body.error;
    } catch {
      // ignore JSON parse errors — use status text
    }
    throw new Error(`API error ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 * Queues a new agent session spawn command via the bridge IPC.
 */
export async function spawnSession(opts: SpawnSessionOpts): Promise<SpawnSessionResult> {
  return apiFetch<SpawnSessionResult>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

/**
 * GET /api/sessions/:id
 * Reads session state from Supabase (server-side service role).
 */
export async function getSession(id: string): Promise<SessionState> {
  return apiFetch<SessionState>(`/api/sessions/${encodeURIComponent(id)}`);
}

/**
 * POST /api/sessions/:id/tasks
 * Queues a task creation command for the given session.
 */
export async function createTask(
  sessionId: string,
  task: CreateTaskOpts,
): Promise<CreateTaskResult> {
  return apiFetch<CreateTaskResult>(
    `/api/sessions/${encodeURIComponent(sessionId)}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify(task),
    },
  );
}
