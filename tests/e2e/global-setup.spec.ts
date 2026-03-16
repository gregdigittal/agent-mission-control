/**
 * Auth setup — runs once as the 'app-setup' Playwright project.
 * Creates tests/e2e/.auth/user.json with a persisted Supabase session
 * so subsequent app-* specs can skip the login flow.
 *
 * Usage:
 *   export E2E_TEST_EMAIL=your@email.com
 *   export E2E_TEST_PASSWORD=yourpassword
 *   npx playwright test --project=app-setup
 *
 * The generated .auth/user.json is gitignored.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

const AUTH_FILE = path.join(import.meta.dirname, '.auth', 'user.json');

setup('authenticate and save session', async ({ page }) => {
  const email = process.env['E2E_TEST_EMAIL'];
  const password = process.env['E2E_TEST_PASSWORD'];

  if (!email || !password) {
    console.warn(
      '[app-setup] E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set. ' +
      'App E2E tests will run without auth and will likely fail at guarded routes.'
    );
    // Save an empty state so dependent projects don't error
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect away from login page
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  // Persist session (cookies + localStorage including Supabase tokens)
  await page.context().storageState({ path: AUTH_FILE });
});
