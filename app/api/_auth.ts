/**
 * Shared Bearer token validation for Vercel serverless functions.
 * Uses constant-time comparison to prevent timing attacks.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Validates the Authorization: Bearer <token> header against
 * AGENT_MC_API_SECRET. Never logs the token value.
 *
 * Returns true if valid, writes a 401 response and returns false if not.
 */
export function validateBearerToken(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env['AGENT_MC_API_SECRET'];
  if (!secret) {
    res.status(500).json({ error: 'API authentication is not configured' });
    return false;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return false;
  }

  const provided = authHeader.slice('Bearer '.length);

  // Constant-time comparison — pad both to the same length using a hash
  // so length differences don't create a timing oracle.
  const expectedBuf = Buffer.from(createHash('sha256').update(secret).digest('hex'), 'utf8');
  const providedBuf = Buffer.from(createHash('sha256').update(provided).digest('hex'), 'utf8');

  let valid = false;
  try {
    valid = timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    // timingSafeEqual throws if buffers differ in length — treat as invalid
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ error: 'Invalid token' });
    return false;
  }

  return true;
}

/**
 * Validates that the Content-Type header is application/json.
 * Returns true if valid, writes a 400 response and returns false if not.
 */
export function requireJsonContentType(req: VercelRequest, res: VercelResponse): boolean {
  const ct = req.headers['content-type'] ?? '';
  if (!ct.includes('application/json')) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return false;
  }
  return true;
}
