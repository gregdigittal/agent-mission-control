/**
 * Outbound webhook emitter — fire-and-forget HTTP POST on bridge events.
 *
 * Zero network listeners. Outbound HTTP only.
 * Configured via `config.webhooks[]` in config.json.
 */

import { createHmac } from 'node:crypto';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Emit a webhook event to all configured endpoints that match the event name. */
export async function emitWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  let config;
  try {
    config = await loadConfig();
  } catch {
    return; // Config not loaded yet — skip
  }

  const webhooks = config.webhooks.filter((w) => matchesEvent(event, w.events));
  if (webhooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (hook) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), hook.timeout_ms);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'agent-mission-control-bridge/1.0',
          'X-AMC-Event': event,
        };

        if (hook.secret) {
          const sig = createHmac('sha256', hook.secret).update(body).digest('hex');
          headers['X-Signature-256'] = `sha256=${sig}`;
        }

        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        if (!res.ok) {
          console.warn(`[webhook] ${hook.label}: HTTP ${res.status} for event "${event}"`);
          await audit('webhook_failed', { label: hook.label, event, status: res.status });
        } else {
          await audit('webhook_sent', { label: hook.label, event });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[webhook] ${hook.label}: failed to deliver "${event}": ${reason}`);
        await audit('webhook_error', { label: hook.label, event, error: reason });
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

/**
 * Returns true if the event name matches any of the patterns.
 * Patterns support a single trailing wildcard: "agent_*" matches "agent_spawned", "agent_exited".
 * The special pattern "*" matches any event.
 */
function matchesEvent(event: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return event.startsWith(pattern.slice(0, -1));
    }
    return pattern === event;
  });
}
