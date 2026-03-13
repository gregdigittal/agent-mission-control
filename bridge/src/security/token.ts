import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { TOKEN_PATH } from '../config.js';

let cachedToken: string | null = null;

export async function ensureSessionToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (existsSync(TOKEN_PATH)) {
    cachedToken = (await readFile(TOKEN_PATH, 'utf-8')).trim();
    return cachedToken;
  }

  const token = randomBytes(32).toString('hex');
  await writeFile(TOKEN_PATH, token, { mode: 0o600 });
  cachedToken = token;
  return token;
}

export async function validateToken(token: string): Promise<boolean> {
  const expected = await ensureSessionToken();
  // Constant-time comparison
  if (token.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
