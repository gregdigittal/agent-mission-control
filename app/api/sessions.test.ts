/**
 * Integration tests — REST API: /api/sessions, /api/sessions/:id, /api/sessions/:id/tasks
 *
 * Tests the Vercel serverless handlers directly (no HTTP server needed).
 * Mocks fs writes and Supabase to keep tests hermetic.
 *
 * Run: cd app && npx vitest run api/sessions.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from('deadbeef0102030405060708', 'hex')),
    timingSafeEqual: actual.timingSafeEqual,
    createHash: actual.createHash,
  };
});

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock the rate limiter so tests don't accumulate rate limit state.
vi.mock('./_ratelimit.ts', () => ({
  defaultLimiter: {
    check: vi.fn().mockReturnValue(true),
    _reset: vi.fn(),
  },
  createRateLimiter: vi.fn(),
}));

// Mock for shared supabase lib (used by sessions.ts GET list)
const mockSupabaseSingle  = vi.fn();
const mockSupabaseSelect  = vi.fn();
const mockSupabaseFrom    = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  isSupabaseConfigured: () => true,
}));

// Mock @supabase/supabase-js createClient — used by sessions/[id].ts and sessions.ts GET/PATCH
const mockServiceSingle   = vi.fn();
const mockServiceSelect   = vi.fn();
const mockServiceUpdate   = vi.fn();
const mockServiceOrder    = vi.fn();
const mockServiceLimit    = vi.fn();
const mockServiceEq       = vi.fn();
const mockServiceLt       = vi.fn();
const mockServiceFrom     = vi.fn();

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
  return {
    ...actual,
    createClient: vi.fn(() => ({
      from: mockServiceFrom,
    })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-secret-token',
      'content-type': 'application/json',
    },
    body: {
      objective: 'Build a login page',
      repoPath: '/home/greg/myproject',
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
    end:       vi.fn(() => res),
  } as unknown as VercelResponse;
  return { res, statusCode: () => _statusCode, body: () => _body };
}

// ── POST /api/sessions ────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  const SECRET = 'test-secret-token';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET'] = SECRET;
    process.env['BRIDGE_COMMAND_DIR']  = '/tmp/test-commands';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['BRIDGE_COMMAND_DIR'];
  });

  it('returns 405 for unsupported methods (PUT)', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ method: 'PUT' });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(405);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ headers: { 'content-type': 'application/json' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(401);
  });

  it('returns 401 when Bearer token is wrong', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ headers: { authorization: 'Bearer wrong-token', 'content-type': 'application/json' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(401);
  });

  it('returns 400 when objective is missing', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ body: { repoPath: '/home/greg/myproject' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(400);
  });

  it('returns 400 when repoPath is missing', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ body: { objective: 'Build a login page' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(400);
  });

  it('returns 415 when Content-Type is not application/json', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq({ headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'text/plain' } });
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(415);
  });

  it('returns 200 with sessionId, commandId, status="queued" on valid request', async () => {
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq();
    const { res, statusCode, body } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
    const b = body() as Record<string, unknown>;
    expect(b).toHaveProperty('sessionId');
    expect(b).toHaveProperty('commandId');
    expect(b['status']).toBe('queued');
  });

  it('writes a spawn command JSON file to BRIDGE_COMMAND_DIR', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { default: handler } = await import('./sessions.ts');
    const req = makeReq();
    const { res } = makeRes();
    await handler(req, res);
    expect(writeFile).toHaveBeenCalledOnce();
    const [filePath, content] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(filePath).toContain('/tmp/test-commands');
    const parsed = JSON.parse(content as string);
    expect(parsed.type).toBe('spawn');
    expect(parsed.objective).toBe('Build a login page');
  });

  it('never logs the Authorization token value', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { default: handler } = await import('./sessions.ts');
    await handler(makeReq(), makeRes().res);
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(SECRET);
    }
    consoleSpy.mockRestore();
  });
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────

describe('GET /api/sessions/:id', () => {
  const SECRET = 'test-secret-token';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET']      = SECRET;
    process.env['SUPABASE_URL']             = 'https://test.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-key';

    // Build the query chain for the service client
    mockServiceSingle.mockResolvedValue({ data: null, error: null });
    mockServiceEq.mockReturnValue({ single: mockServiceSingle });
    mockServiceSelect.mockReturnValue({ eq: mockServiceEq });
    mockServiceFrom.mockReturnValue({ select: mockServiceSelect });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  });

  it('returns 401 when token is missing', async () => {
    const { default: handler } = await import('./sessions/[id].ts');
    const req = { method: 'GET', headers: {}, query: { id: 'abc' } } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(401);
  });

  it('returns 405 for unsupported methods (PUT)', async () => {
    const { default: handler } = await import('./sessions/[id].ts');
    const req = { method: 'PUT', headers: { authorization: `Bearer ${SECRET}` }, query: { id: 'abc' } } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(405);
  });

  it('returns 404 when session does not exist in Supabase', async () => {
    mockServiceSingle.mockResolvedValue({ data: null, error: { message: 'Not found', code: 'PGRST116' } });
    const { default: handler } = await import('./sessions/[id].ts');
    const req = { method: 'GET', headers: { authorization: `Bearer ${SECRET}` }, query: { id: 'nonexistent' } } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(404);
  });

  it('returns 200 with session data when found', async () => {
    const mockSession = { id: 'session-123', status: 'running', objective: 'Build login' };
    mockServiceSingle.mockResolvedValue({ data: mockSession, error: null });
    const { default: handler } = await import('./sessions/[id].ts');
    const req = { method: 'GET', headers: { authorization: `Bearer ${SECRET}` }, query: { id: 'session-123' } } as unknown as VercelRequest;
    const { res, statusCode, body } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
    expect((body() as Record<string, unknown>)['id']).toBe('session-123');
  });
});

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────

describe('DELETE /api/sessions/:id', () => {
  const SECRET = 'test-secret-token';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET']      = SECRET;
    process.env['BRIDGE_COMMAND_DIR']       = '/tmp/test-commands';
    process.env['SUPABASE_URL']             = 'https://test.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['BRIDGE_COMMAND_DIR'];
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  });

  it('writes a terminate command and returns status="terminating"', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { default: handler } = await import('./sessions/[id].ts');
    const req = { method: 'DELETE', headers: { authorization: `Bearer ${SECRET}` }, query: { id: 'sess-del-1' } } as unknown as VercelRequest;
    const { res, statusCode, body } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
    expect((body() as Record<string, unknown>)['status']).toBe('terminating');
    expect(writeFile).toHaveBeenCalledOnce();
    const [, content] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse(content as string);
    expect(parsed.type).toBe('terminate');
    expect(parsed.sessionId).toBe('sess-del-1');
  });
});

// ── PATCH /api/sessions/:id ───────────────────────────────────────────────────

describe('PATCH /api/sessions/:id', () => {
  const SECRET = 'test-secret-token';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET']      = SECRET;
    process.env['SUPABASE_URL']             = 'https://test.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-key';

    // Build the PATCH chain: from → update → eq → select → single
    const selectChain = { single: vi.fn().mockResolvedValue({ data: { id: 'sess-1', status: 'paused' }, error: null }) };
    const eqChain     = { select: vi.fn().mockReturnValue(selectChain) };
    const updateChain = { eq: vi.fn().mockReturnValue(eqChain) };
    mockServiceUpdate.mockReturnValue(updateChain);

    const getChain = { eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    mockServiceSelect.mockReturnValue(getChain);

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'agent_sessions') {
        return { select: mockServiceSelect, update: mockServiceUpdate };
      }
      return { select: mockServiceSelect, update: mockServiceUpdate };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
  });

  it('returns 400 when neither status nor objective is provided', async () => {
    const { default: handler } = await import('./sessions/[id].ts');
    const req = {
      method: 'PATCH',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      query: { id: 'sess-1' },
      body: {},
    } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(400);
  });

  it('returns 200 with updated session on valid PATCH', async () => {
    const { default: handler } = await import('./sessions/[id].ts');
    const req = {
      method: 'PATCH',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      query: { id: 'sess-1' },
      body: { status: 'paused' },
    } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
  });

  it('returns 415 when Content-Type is not application/json', async () => {
    const { default: handler } = await import('./sessions/[id].ts');
    const req = {
      method: 'PATCH',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'text/plain' },
      query: { id: 'sess-1' },
      body: { status: 'paused' },
    } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(415);
  });
});

// ── POST /api/sessions/:id/tasks ──────────────────────────────────────────────

describe('POST /api/sessions/:id/tasks', () => {
  const SECRET = 'test-secret-token';

  beforeEach(() => {
    process.env['AGENT_MC_API_SECRET'] = SECRET;
    process.env['BRIDGE_COMMAND_DIR']  = '/tmp/test-commands';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['AGENT_MC_API_SECRET'];
    delete process.env['BRIDGE_COMMAND_DIR'];
  });

  it('returns 400 when title is missing', async () => {
    const { default: handler } = await import('./sessions/[id]/tasks.ts');
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      query: { id: 'session-123' },
      body: {},
    } as unknown as VercelRequest;
    const { res, statusCode } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(400);
  });

  it('returns 200 with taskId and status="queued" on valid request', async () => {
    const { default: handler } = await import('./sessions/[id]/tasks.ts');
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      query: { id: 'session-123' },
      body: { title: 'Add user auth', description: 'Implement email + OAuth', priority: 'high' },
    } as unknown as VercelRequest;
    const { res, statusCode, body } = makeRes();
    await handler(req, res);
    expect(statusCode()).toBe(200);
    const b = body() as Record<string, unknown>;
    expect(b).toHaveProperty('taskId');
    expect(b['status']).toBe('queued');
  });

  it('writes a create_task command targeting the correct sessionId', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { default: handler } = await import('./sessions/[id]/tasks.ts');
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      query: { id: 'session-abc' },
      body: { title: 'Fix bug', priority: 'medium' },
    } as unknown as VercelRequest;
    await handler(req, makeRes().res);
    const [, content] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse(content as string);
    expect(parsed.type).toBe('create_task');
    expect(parsed.sessionId).toBe('session-abc');
  });
});
