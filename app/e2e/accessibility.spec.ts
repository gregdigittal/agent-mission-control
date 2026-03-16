import { test, expect } from '@playwright/test';

/**
 * Basic WCAG 2.1 accessibility smoke tests.
 * Verifies keyboard navigability and ARIA landmarks without requiring auth.
 */

test.describe('Accessibility — login page', () => {
  test('page has a main landmark or heading', async ({ page }) => {
    await page.goto('/login');
    const main = page.locator('main').or(page.getByRole('main'));
    const heading = page.getByRole('heading');
    await expect(main.or(heading)).toBeVisible();
  });

  test('all inputs have accessible labels', async ({ page }) => {
    await page.goto('/login');
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      // At least one labelling mechanism must be present
      const isLabelled = Boolean(id || ariaLabel || ariaLabelledBy || placeholder);
      expect(isLabelled, `Input at index ${i} has no accessible label`).toBe(true);
    }
  });

  test('submit button is keyboard activatable', async ({ page }) => {
    await page.goto('/login');
    const submitBtn = page.getByRole('button', { name: /sign in|log in|login/i });
    await expect(submitBtn).toBeVisible();
    // Tab to the button (focus traversal smoke test)
    await page.keyboard.press('Tab');
    // The button must be focusable
    const isFocusable = await submitBtn.evaluate((el) => {
      return el.tabIndex >= 0;
    });
    expect(isFocusable).toBe(true);
  });

  test('page has a lang attribute', async ({ page }) => {
    await page.goto('/login');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });
});
