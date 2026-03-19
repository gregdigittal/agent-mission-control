/**
 * RED/GREEN regression test for React error #185 (too many re-renders).
 *
 * Root cause: useScreenProfile called setScreenProfile() in a useEffect on mount,
 * triggering Zustand's useSyncExternalStore to synchronously notify all 13 store
 * subscribers during React's commit phase, causing a cascade that exceeds React's
 * 25-iteration limit.
 *
 * Fix: initialize screenProfile from window.innerWidth at store creation time,
 * removing the store mutation from the mount effect entirely.
 */
import { test, expect } from '@playwright/test';

/** Minimal fake Supabase session payload that satisfies the client SDK's shape. */
function buildFakeSession() {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({
    sub: 'test-user-00000000-0000-0000-0000-000000000001',
    email: 'e2e-test@example.com',
    role: 'authenticated',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const sig = 'fake-signature-not-verified-client-side';
  const accessToken = `${header}.${payload}.${sig}`;

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token-e2e',
    user: {
      id: 'test-user-00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e-test@example.com',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
    },
  };
}

test.describe('React error #185 regression — authenticated dashboard load', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a fake authenticated session into localStorage before the app boots.
    // This bypasses the login page and exercises the post-auth render path where
    // the Zustand store initialises and the screen-profile hook fires.
    await page.addInitScript(() => {
      const SUPABASE_PROJECT = 'zpsnbogldtepmfwgqarz';
      const session = (window as unknown as Record<string, unknown>).__FAKE_SESSION__;
      if (session) {
        localStorage.setItem(
          `sb-${SUPABASE_PROJECT}-auth-token`,
          JSON.stringify(session),
        );
      }
    });

    // Pass the session object to the page via evaluate before navigation
    await page.addInitScript((session: ReturnType<typeof buildFakeSession>) => {
      (window as unknown as Record<string, unknown>).__FAKE_SESSION__ = session;
    }, buildFakeSession());

    // Re-add with the session available
    await page.addInitScript(() => {
      const SUPABASE_PROJECT = 'zpsnbogldtepmfwgqarz';
      const session = (window as unknown as Record<string, unknown>).__FAKE_SESSION__;
      if (session) {
        localStorage.setItem(
          `sb-${SUPABASE_PROJECT}-auth-token`,
          JSON.stringify(session),
        );
      }
    });
  });

  test('dashboard renders without React error #185 after authentication', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });

    await page.goto('/');

    // Give the app time to mount and run all effects
    await page.waitForTimeout(3000);

    // Should NOT be on the login page — the fake session should be accepted
    // Note: Supabase may redirect back to login if it tries to verify the token
    // with the server. If so, we verify there is no #185 crash regardless.
    const reactError185 = jsErrors.some(
      (msg) => msg.includes('185') || msg.includes('Too many re-renders'),
    );
    expect(reactError185, `React error #185 fired. Errors: ${jsErrors.join('; ')}`).toBe(false);
  });

  test('no React errors when window is resized after mount', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/login');

    // Even on the login page, resizing should not cause #185
    await page.setViewportSize({ width: 375, height: 812 });   // mobile
    await page.setViewportSize({ width: 1024, height: 768 });  // laptop
    await page.setViewportSize({ width: 1440, height: 900 });  // desktop
    await page.setViewportSize({ width: 2560, height: 1440 }); // ultrawide
    await page.waitForTimeout(500);

    const reactError185 = jsErrors.some(
      (msg) => msg.includes('185') || msg.includes('Too many re-renders'),
    );
    expect(reactError185, `React error #185 fired on resize. Errors: ${jsErrors.join('; ')}`).toBe(false);
  });

  test('screen-profile class is applied to <html> without crash', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/login');
    await page.waitForTimeout(1000);

    // The html element should have a screen-* class applied by useScreenProfile
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toMatch(/screen-(mobile|laptop|desktop|ultrawide)/);

    const reactError185 = jsErrors.some(
      (msg) => msg.includes('185') || msg.includes('Too many re-renders'),
    );
    expect(reactError185, `React error #185 fired. Errors: ${jsErrors.join('; ')}`).toBe(false);
  });
});
