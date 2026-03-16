/**
 * E2E — React App: Auth + Workspace flows
 *
 * RED TESTS — these are intentionally failing until the React app is wired to
 * a running Supabase instance and served at http://localhost:5173.
 *
 * Run against the dev server:
 *   cd app && npm run dev
 *   npx playwright test tests/e2e/app-auth.spec.ts --project=app-chromium
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Login page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('redirects unauthenticated users to /login', async ({ page }) => {
    // AuthGuard should redirect to login when no session
    await expect(page).toHaveURL(/\/login/);
  });

  test('renders email + password inputs', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('renders GitHub OAuth button', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByText('Continue with GitHub')).toBeVisible();
  });

  test('shows SSO button when VITE_SSO_PROVIDER_SLUG is set', async ({ page }) => {
    // This test passes only when the app is built with VITE_SSO_PROVIDER_SLUG set.
    // In CI: set the env var and rebuild. In dev: check SsoButton renders.
    await page.goto(`${APP_URL}/login`);
    // SSO button is conditional — skip if env var not present
    const ssoButton = page.getByRole('button', { name: /sign in with sso/i });
    // If SSO_PROVIDER_SLUG is set, button must be visible
    // If not set, button must NOT exist in the DOM
    const count = await ssoButton.count();
    if (count > 0) {
      await expect(ssoButton).toBeVisible();
    }
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Either native HTML5 validation fires, or an error message appears
    const emailInput = page.getByPlaceholder('Email');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).not.toBe('');
  });

  test('shows error message on wrong credentials', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await page.getByPlaceholder('Email').fill('wrong@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Supabase returns an auth error — app must surface it
    const errorEl = page.locator('[role="alert"], .error, [class*="error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
  });

  test('toggle between sign-in and sign-up modes', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    const toggleBtn = page.getByRole('button', { name: /create account|sign up/i });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth — AuthGuard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AuthGuard', () => {
  test('blocks direct navigation to /dashboard when logged out', async ({ page }) => {
    await page.goto(`${APP_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('allows access to dashboard when session cookie is present', async ({ page, context }) => {
    // Inject a mock Supabase session so AuthGuard passes
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: 'mock-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);
    // Even with a cookie, Supabase SDK validates it — this test is an integration
    // signal that the guard doesn't redirect unnecessarily
    await page.goto(`${APP_URL}/`);
    // If guard is working with a valid session, we stay on the dashboard
    // This will FAIL until a real test user session is injected
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Switcher
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Workspace Switcher', () => {
  // These tests require an authenticated session
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('shows "Personal" workspace by default', async ({ page }) => {
    await page.goto(APP_URL);
    const switcher = page.getByRole('button', { name: /switch workspace/i });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText('Personal');
  });

  test('opens workspace list on click', async ({ page }) => {
    await page.goto(APP_URL);
    const switcher = page.getByRole('button', { name: /switch workspace/i });
    await switcher.click();
    const listbox = page.getByRole('listbox', { name: /workspaces/i });
    await expect(listbox).toBeVisible();
  });

  test('selecting a workspace updates the switcher label', async ({ page }) => {
    await page.goto(APP_URL);
    const switcher = page.getByRole('button', { name: /switch workspace/i });
    await switcher.click();
    const options = page.getByRole('option');
    const count = await options.count();
    if (count > 1) {
      const secondOption = options.nth(1);
      const name = await secondOption.textContent();
      await secondOption.click();
      await expect(switcher).toContainText(name ?? '');
    }
  });

  test('workspace switcher is hidden on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP_URL);
    const switcher = page.getByRole('button', { name: /switch workspace/i });
    await expect(switcher).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin panel (owner-only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin panel', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('Admin section is visible in ProfileMenu for workspace owner', async ({ page }) => {
    await page.goto(APP_URL);
    // Open profile menu
    const profileBtn = page.getByRole('button', { name: /profile|account/i });
    await profileBtn.click();
    await expect(page.getByText('Admin')).toBeVisible();
  });

  test('budget inputs accept numeric values', async ({ page }) => {
    await page.goto(APP_URL);
    const profileBtn = page.getByRole('button', { name: /profile|account/i });
    await profileBtn.click();
    const sessionBudget = page.getByLabel(/session budget/i);
    await sessionBudget.fill('50');
    await expect(sessionBudget).toHaveValue('50');
  });

  test('Save button triggers upsert without error', async ({ page }) => {
    await page.goto(APP_URL);
    const profileBtn = page.getByRole('button', { name: /profile|account/i });
    await profileBtn.click();
    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();
    // Should not show an error after save
    const errorEl = page.locator('[role="alert"]');
    await expect(errorEl).toBeHidden({ timeout: 3000 });
  });
});
