import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL ?? '';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? '';
const HAS_CREDENTIALS = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe('Kanban board', () => {
  test.skip(!HAS_CREDENTIALS, 'Skipped: set E2E_EMAIL and E2E_PASSWORD to run');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(E2E_EMAIL);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/^(?!.*login).*$/, { timeout: 15_000 });
    // Navigate to kanban tab
    const kanbanTab = page.getByRole('tab', { name: /kanban/i });
    if (await kanbanTab.isVisible()) await kanbanTab.click();
  });

  test('kanban columns are visible', async ({ page }) => {
    const kanban = page.locator('[data-testid="kanban"], .kanban-board, [aria-label*="anban"]');
    await expect(kanban).toBeVisible({ timeout: 10_000 });
  });

  test('can navigate to kanban via bottom nav on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const kanbanBtn = page.getByRole('tab', { name: /kanban/i });
    await expect(kanbanBtn).toBeVisible({ timeout: 10_000 });
    await kanbanBtn.click();
    // Board or empty state should appear
    await expect(
      page.locator('[data-testid="kanban"]').or(page.getByText(/no tasks|backlog|todo/i))
    ).toBeVisible({ timeout: 8_000 });
  });
});
