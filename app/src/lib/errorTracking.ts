/**
 * Error tracking wrapper — Sentry-compatible interface, no external dependency.
 *
 * Drop-in replacement for @sentry/react. If VITE_SENTRY_DSN is set, forwards
 * events to the Sentry Envelope API via navigator.sendBeacon (fire-and-forget).
 * When the DSN is absent, errors are captured in an in-memory ring buffer that
 * developer tools can inspect at `window.__errorLog`.
 */

// ── Types (Sentry-compatible surface) ───────────────────────────────────────

export interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  user?: { id?: string; email?: string };
}

export interface Breadcrumb {
  type?: string;
  category?: string;
  message: string;
  level?: ErrorContext['level'];
  timestamp?: number;
  data?: Record<string, unknown>;
}

export interface ErrorEvent {
  eventId: string;
  timestamp: number;
  message: string;
  stack?: string;
  level: NonNullable<ErrorContext['level']>;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  user?: ErrorContext['user'];
  breadcrumbs: Breadcrumb[];
}

// ── Internal state ───────────────────────────────────────────────────────────

const MAX_BUFFER = 100;
const MAX_BREADCRUMBS = 20;

const buffer: ErrorEvent[] = [];
const breadcrumbs: Breadcrumb[] = [];
let dsn: string | null = null;
let currentUser: ErrorContext['user'] | undefined;
let release: string | undefined;

// Expose buffer on window for devtools
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__errorLog = buffer;
}

// ── Initialisation ───────────────────────────────────────────────────────────

/**
 * Call once during app bootstrap.
 * Reads VITE_SENTRY_DSN from env; registers unhandled error + rejection listeners.
 */
export function initErrorTracking(opts?: { release?: string }): void {
  dsn = import.meta.env.VITE_SENTRY_DSN ?? null;
  release = opts?.release ?? import.meta.env.VITE_APP_VERSION;

  window.addEventListener('error', (e) => {
    captureException(e.error ?? new Error(e.message), {
      tags: { source: 'window.onerror' },
      extra: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    captureException(err, { tags: { source: 'unhandledrejection' } });
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Identify the current user — attached to all subsequent events. */
export function setUser(user: ErrorContext['user']): void {
  currentUser = user;
}

/** Clears the current user identity (e.g. on logout). */
export function clearUser(): void {
  currentUser = undefined;
}

/** Add a breadcrumb to the rolling trail that accompanies the next captured event. */
export function addBreadcrumb(crumb: Breadcrumb): void {
  breadcrumbs.push({ ...crumb, timestamp: crumb.timestamp ?? Date.now() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

/** Capture an Error object. Returns a unique event ID. */
export function captureException(err: unknown, ctx?: ErrorContext): string {
  const error = err instanceof Error ? err : new Error(String(err));
  const event = buildEvent(error.message, error.stack, ctx);
  dispatch(event);
  return event.eventId;
}

/** Capture an arbitrary message (non-exception). Returns a unique event ID. */
export function captureMessage(message: string, ctx?: ErrorContext): string {
  const event = buildEvent(message, undefined, ctx);
  dispatch(event);
  return event.eventId;
}

/** Returns a snapshot of the in-memory event buffer (useful in tests / devtools). */
export function getErrorBuffer(): readonly ErrorEvent[] {
  return buffer;
}

/** Clears the in-memory buffer (useful in tests). */
export function clearErrorBuffer(): void {
  buffer.splice(0);
}

/** Clears the breadcrumb trail (useful in tests). */
export function clearBreadcrumbs(): void {
  breadcrumbs.splice(0);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildEvent(message: string, stack: string | undefined, ctx?: ErrorContext): ErrorEvent {
  return {
    eventId: generateId(),
    timestamp: Date.now(),
    message,
    stack,
    level: ctx?.level ?? 'error',
    tags: { ...(release ? { release } : {}), ...(ctx?.tags ?? {}) },
    extra: ctx?.extra ?? {},
    user: ctx?.user ?? currentUser,
    breadcrumbs: [...breadcrumbs],
  };
}

function dispatch(event: ErrorEvent): void {
  // Always buffer locally
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  // Forward to Sentry endpoint if configured
  if (dsn) {
    sendToSentry(event, dsn);
  } else {
    console.error('[errorTracking]', event.level.toUpperCase(), event.message, event.stack ?? '');
  }
}

function sendToSentry(event: ErrorEvent, dsnUrl: string): void {
  try {
    // Sentry envelope format (minimal — enough for event ingestion)
    const envelope = [
      JSON.stringify({ dsn: dsnUrl, sdk: { name: 'agent-mc', version: '1.0.0' } }),
      '\n',
      JSON.stringify({ type: 'event' }),
      '\n',
      JSON.stringify({
        event_id: event.eventId,
        timestamp: event.timestamp / 1000,
        level: event.level,
        message: event.message,
        exception: event.stack ? {
          values: [{ type: 'Error', value: event.message, stacktrace: { frames: parseStack(event.stack) } }],
        } : undefined,
        tags: event.tags,
        extra: event.extra,
        user: event.user,
        breadcrumbs: { values: event.breadcrumbs },
        release: event.tags['release'],
      }),
    ].join('');

    // Use sendBeacon so it doesn't block page unload
    const url = buildEnvelopeUrl(dsnUrl);
    if (url && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([envelope], { type: 'application/x-sentry-envelope' }));
    }
  } catch {
    // Never let error reporting crash the app
  }
}

function buildEnvelopeUrl(dsnUrl: string): string | null {
  try {
    const u = new URL(dsnUrl);
    return `${u.protocol}//${u.host}/api${u.pathname}/envelope/`;
  } catch {
    return null;
  }
}

function parseStack(stack: string): Array<{ filename: string; function: string; lineno: number }> {
  return stack.split('\n').slice(1, 10).map((line) => {
    const m = line.match(/at (.+?) \((.+?):(\d+):\d+\)/);
    return m
      ? { function: m[1], filename: m[2], lineno: parseInt(m[3], 10) }
      : { function: line.trim(), filename: 'unknown', lineno: 0 };
  });
}

function generateId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
