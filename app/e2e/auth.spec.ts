import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    // Should land on login page (or redirect to it)
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login page has a submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in|log in|login/i })).toBeVisible();
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    // Form validation should surface an error — either native or custom
    const err = page.getByRole('alert').or(page.getByText(/required|invalid|enter/i));
    await expect(err).toBeVisible({ timeout: 5000 });
  });
});
