/**
 * Unit tests — _ratelimit: sliding window rate limiter
 */
import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter } from './_ratelimit.ts';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function makeReq(ip = '1.2.3.4'): VercelRequest {
  return {
    headers: { 'x-forwarded-for': ip },
  } as unknown as VercelRequest;
}

function makeRes() {
  let _statusCode = 200;
  let _body: unknown;
  const headers: Record<string, string> = {};
  const res = {
    status: vi.fn(function (code: number) { _statusCode = code; return res; }),
    json:   vi.fn(function (data: unknown) { _body = data; return res; }),
    setHeader: vi.fn(function (name: string, value: string) { headers[name] = value; return res; }),
  } as unknown as VercelResponse;
  return { res, statusCode: () => _statusCode, body: () => _body, headers: () => headers };
}

describe('createRateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    const req = makeReq();
    for (let i = 0; i < 5; i++) {
      const { res, statusCode } = makeRes();
      const allowed = limiter.check(req, res);
      expect(allowed).toBe(true);
      expect(statusCode()).toBe(200);
    }
  });

  it('blocks requests that exceed the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const req = makeReq();
    limiter.check(req, makeRes().res);
    limiter.check(req, makeRes().res);

    // Third request should be blocked
    const { res, statusCode } = makeRes();
    const allowed = limiter.check(req, res);
    expect(allowed).toBe(false);
    expect(statusCode()).toBe(429);
  });

  it('sets rate limit headers on every request', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const req = makeReq();
    const { res, headers } = makeRes();
    limiter.check(req, res);

    expect(headers()['X-RateLimit-Limit']).toBe('10');
    expect(headers()['X-RateLimit-Remaining']).toBeDefined();
    expect(headers()['X-RateLimit-Reset']).toBeDefined();
  });

  it('tracks limits independently per IP', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    const req1 = makeReq('1.1.1.1');
    const req2 = makeReq('2.2.2.2');

    // First request from each IP — should be allowed
    expect(limiter.check(req1, makeRes().res)).toBe(true);
    expect(limiter.check(req2, makeRes().res)).toBe(true);

    // Second request from req1 — blocked; req2 still has one more
    const { res: blocked } = makeRes();
    expect(limiter.check(req1, blocked)).toBe(false);
  });

  it('_reset clears all windows', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    const req = makeReq();
    limiter.check(req, makeRes().res); // first allowed, now at limit
    limiter._reset();
    // After reset, first request should be allowed again
    expect(limiter.check(req, makeRes().res)).toBe(true);
  });

  it('uses X-Forwarded-For header for the client key', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    const req = { headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' } } as unknown as VercelRequest;
    limiter.check(req, makeRes().res); // exhaust limit for 10.0.0.1

    // Different IP (forwarded header missing) should still be allowed
    const reqNoIp = { headers: {} } as unknown as VercelRequest;
    const { statusCode } = makeRes();
    const result = limiter.check(reqNoIp, makeRes().res);
    expect(result).toBe(true); // 'unknown' key is separate from '10.0.0.1'
    void statusCode;
  });
});
