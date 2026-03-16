import { test, expect } from '@playwright/test';

/**
 * Dashboard smoke tests.
 * These run against a dev server and require Supabase credentials in E2E_EMAIL / E2E_PASSWORD.
 * In CI without credentials, only the login-wall checks run.
 */

const E2E_EMAIL = process.env.E2E_EMAIL ?? '';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? '';
const HAS_CREDENTIALS = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe('Dashboard (unauthenticated)', () => {
  test('root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Dashboard (authenticated)', () => {
  test.skip(!HAS_CREDENTIALS, 'Skipped: set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(E2E_EMAIL);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/^(?!.*login).*$/, { timeout: 15_000 });
  });

  test('dashboard renders after login', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    // Main content container should be visible
    await expect(page.locator('main, [data-testid="dashboard"], #root > *:not(script)')).toBeVisible();
  });

  test('screen profile picker is visible', async ({ page }) => {
    // At least one screen picker button should be visible
    const pickerBtns = page.getByRole('button', { name: /layout|mobile|laptop|desktop|ultrawide/i });
    await expect(pickerBtns.first()).toBeVisible({ timeout: 10_000 });
  });

  test('session tabs area is present', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: 'Sessions' });
    await expect(tablist).toBeVisible({ timeout: 10_000 });
  });
});
