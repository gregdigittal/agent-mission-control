import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

import { emitWebhook } from './emitter.js';
import { loadConfig } from '../config.js';

function cfg(overrides: Record<string, unknown> = {}) {
  return {
    webhooks: [],
    review_loop: { max_retries: 3, retry_prompt_suffix: '', auto_review_on_failure: false },
    ...overrides,
  };
}

describe('emitWebhook', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockResolvedValue(cfg() as ReturnType<typeof cfg> as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });

  it('does nothing when no webhooks configured', async () => {
    await emitWebhook('agent_spawned', { agentKey: 'a' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to matching webhook', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'test', url: 'https://example.com/hook', events: ['agent_spawned'], timeout_ms: 1000 }],
    }) as never);

    await emitWebhook('agent_spawned', { agentKey: 'a' });
    expect(fetch).toHaveBeenCalledOnce();

    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body as string);
    expect(body.event).toBe('agent_spawned');
    expect(body.data.agentKey).toBe('a');
  });

  it('skips webhook when event does not match', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'test', url: 'https://example.com/hook', events: ['agent_exited'], timeout_ms: 1000 }],
    }) as never);

    await emitWebhook('agent_spawned', {});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('matches wildcard pattern *', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'all', url: 'https://example.com/hook', events: ['*'], timeout_ms: 1000 }],
    }) as never);

    await emitWebhook('anything_at_all', {});
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('matches prefix wildcard agent_*', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'agents', url: 'https://example.com/hook', events: ['agent_*'], timeout_ms: 1000 }],
    }) as never);

    await emitWebhook('agent_exited', {});
    await emitWebhook('agent_spawned', {});
    await emitWebhook('loop_error', {}); // should NOT match

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('adds X-Signature-256 header when secret is set', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'signed', url: 'https://example.com/hook', events: ['*'], secret: 'mysecret', timeout_ms: 1000 }],
    }) as never);

    await emitWebhook('test', {});
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.headers['X-Signature-256']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('does not throw when fetch fails', async () => {
    vi.mocked(loadConfig).mockResolvedValue(cfg({
      webhooks: [{ label: 'broken', url: 'https://example.com/hook', events: ['*'], timeout_ms: 1000 }],
    }) as never);

    vi.mocked(global.fetch).mockRejectedValue(new Error('network error'));

    await expect(emitWebhook('test', {})).resolves.not.toThrow();
  });
});
