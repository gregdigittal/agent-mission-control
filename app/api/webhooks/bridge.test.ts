/**
 * Unit tests — POST /api/webhooks/bridge (reverse webhook)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    timingSafeEqual: actual.timingSafeEqual,
    createHash: actual.createHash,
  };
});

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-secret',
      'content-type': 'application/json',
    },
    body: {
      sessionId: 'sess-1',
      event: 'agent_exited',
      exitCode: 0,
    },
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  let _statusCode = 200;
  let _body: unknown;
  const res = {
    status:    vi.fn(function (code: number) { _statusCode = code; return res; }),
    json:      vi.fn(function (data: unknown) { _body = data; return res; }),
    setHeader: vi.fn(() => res),
  } as unknown as VercelResponse;
  return { res, statusCode: () => _statusCode, body: () => _body };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/bridge', () => {
  const SECRET = 'test-secret';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET'] = SECRET;
    mockFetch.mockResolvedValue({ ok: true, status: 201, statusText: 'Created' });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['GITHUB_STATUS_TOKEN'];
  });

  it('returns 405 for non-POST requests', async () => {
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({ method: 'GET' });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(405);
  });

  it('returns 401 when token is missing', async () => {
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({ headers: { 'content-type': 'application/json' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(401);
  });

  it('returns 400 when sessionId or event is missing', async () => {
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({ body: { event: 'agent_exited' } }); // missing sessionId
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(400);
  });

  it('returns 200 with ok:true on valid payload', async () => {
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq();
    const { res, statusCode, body } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
    expect((body() as Record<string, unknown>)['ok']).toBe(true);
  });

  it('does not call GitHub API when commitSha and repoName are absent', async () => {
    process.env['GITHUB_STATUS_TOKEN'] = 'gh-token';
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({ body: { sessionId: 'sess-1', event: 'agent_exited' } });
    const { res } = makeRes();
    await handler(req, res);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls GitHub statuses API when commitSha and repoName are present', async () => {
    process.env['GITHUB_STATUS_TOKEN'] = 'gh-token';
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({
      body: {
        sessionId: 'sess-1',
        event: 'agent_exited',
        exitCode: 0,
        commitSha: 'abc123def456',
        repoName: 'gregmorris/my-repo',
      },
    });
    const { res } = makeRes();
    await handler(req, res);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/repos/gregmorris/my-repo/statuses/abc123def456');
    const payload = JSON.parse(options.body as string);
    expect(payload.state).toBe('success');
    expect(payload.context).toBe('agent-mission-control/review');
  });

  it('maps exitCode !== 0 to failure GitHub state', async () => {
    process.env['GITHUB_STATUS_TOKEN'] = 'gh-token';
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({
      body: {
        sessionId: 'sess-2',
        event: 'agent_exited',
        exitCode: 1,
        commitSha: 'deadbeef',
        repoName: 'gregmorris/my-repo',
      },
    });
    const { res } = makeRes();
    await handler(req, res);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body as string);
    expect(payload.state).toBe('failure');
  });

  it('does not call GitHub API when GITHUB_STATUS_TOKEN is not set', async () => {
    delete process.env['GITHUB_STATUS_TOKEN'];
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({
      body: {
        sessionId: 'sess-3',
        event: 'agent_exited',
        commitSha: 'abc123',
        repoName: 'gregmorris/my-repo',
      },
    });
    const { res } = makeRes();
    await handler(req, res);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 415 for non-JSON Content-Type', async () => {
    const { default: handler } = await import('./bridge.ts');
    const req = makeReq({ headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'text/plain' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(415);
  });
});
