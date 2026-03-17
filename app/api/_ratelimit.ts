/**
 * Simple in-memory sliding window rate limiter for Vercel serverless handlers.
 *
 * Not suitable for multi-instance deployments without an external store (Redis, etc.),
 * but provides a meaningful defence for single-instance or low-throughput cases.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
 *   if (!limiter.check(req, res)) return; // already sent 429
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Types ────────────────────────────────────────────────────────────────────

export type RateLimiterOptions = {
  /** Rolling window size in milliseconds. Default: 60 000 (1 minute). */
  readonly windowMs?: number;
  /** Maximum requests allowed in the window. Default: 60. */
  readonly maxRequests?: number;
};

export type RateLimiter = {
  /** Returns true if the request is within the rate limit. Writes a 429 and returns false if exceeded. */
  check(req: VercelRequest, res: VercelResponse): boolean;
  /** Exposed for testing — clears all request timestamps. */
  _reset(): void;
};

// ── Implementation ────────────────────────────────────────────────────────────

/** Extract a stable identifier for rate limiting (X-Forwarded-For → first IP, else fallback). */
function clientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown';
  if (Array.isArray(forwarded)) return forwarded[0]?.trim() ?? 'unknown';
  return 'unknown';
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs    = options.windowMs    ?? 60_000;
  const maxRequests = options.maxRequests ?? 60;

  // Map from client key → sorted array of request timestamps (epoch ms)
  const windows = new Map<string, number[]>();

  return {
    check(req: VercelRequest, res: VercelResponse): boolean {
      const key = clientKey(req);
      const now = Date.now();
      const cutoff = now - windowMs;

      const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff);
      timestamps.push(now);
      windows.set(key, timestamps);

      const remaining = Math.max(0, maxRequests - timestamps.length);
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      if (timestamps.length > maxRequests) {
        res.status(429).json({ error: 'Too many requests — please retry after the rate limit window resets' });
        return false;
      }

      return true;
    },

    _reset(): void {
      windows.clear();
    },
  };
}

/** Default rate limiter: 60 requests per minute per IP. */
export const defaultLimiter = createRateLimiter();
