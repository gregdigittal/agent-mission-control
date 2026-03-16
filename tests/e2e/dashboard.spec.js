// @ts-check
const { test, expect } = require('@playwright/test');

// ─────────────────────────────────────────────────────────────────────────────
// First-run modal (F-004)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('First-run modal', () => {
  test('shows on fresh visit (no localStorage)', async ({ page }) => {
    await page.goto('/');
    // Clear any saved screen profile so modal triggers
    await page.evaluate(() => localStorage.removeItem('amc_screen'));
    await page.reload();

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Agent Mission Control');
  });

  test('dismisses and persists screen choice', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('amc_screen'));
    await page.reload();

    // Select Ultrawide card and confirm
    await page.locator('.screen-card[data-screen="ultrawide"]').click();
    await page.locator('#modal-confirm').click();

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeHidden();

    const saved = await page.evaluate(() => localStorage.getItem('amc_screen'));
    expect(saved).toBe('ultrawide');
  });

  test('does not show on second visit', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('amc_screen', 'desktop'));
    await page.reload();

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard shortcuts (F-005)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss modal so keyboard shortcuts are active
    await page.evaluate(() => localStorage.setItem('amc_screen', 'desktop'));
    await page.reload();
  });

  test('F toggles file watch bar', async ({ page }) => {
    const bar = page.locator('#filewatch-bar');
    // Bar starts visible (added by init)
    await expect(bar).toHaveClass(/visible/);
    await page.keyboard.press('f');
    await expect(bar).not.toHaveClass(/visible/);
    await page.keyboard.press('f');
    await expect(bar).toHaveClass(/visible/);
  });

  test('? toggles help panel', async ({ page }) => {
    const panel = page.locator('#help-panel');
    await expect(panel).not.toHaveClass(/open/);
    await page.keyboard.press('?');
    await expect(panel).toHaveClass(/open/);
    await page.keyboard.press('?');
    await expect(panel).not.toHaveClass(/open/);
  });

  test('L/D/U switch screen profile', async ({ page }) => {
    await page.keyboard.press('l');
    await expect(page.locator('body')).toHaveClass(/screen-laptop/);
    await page.keyboard.press('d');
    await expect(page.locator('body')).toHaveClass(/screen-desktop/);
    await page.keyboard.press('u');
    await expect(page.locator('body')).toHaveClass(/screen-ultrawide/);
  });

  test('1 and 2 switch pane layout', async ({ page }) => {
    // Desktop profile supports up to 3 panes
    await page.keyboard.press('d');
    await page.keyboard.press('1');
    const panes1 = await page.locator('.pane').count();
    expect(panes1).toBe(1);
    await page.keyboard.press('2');
    const panes2 = await page.locator('.pane').count();
    expect(panes2).toBe(2);
  });

  test('shortcuts blocked when typing in input', async ({ page }) => {
    const input = page.locator('#fw-path');
    await input.click();
    await input.pressSequentially('l');
    // Body class should not change to screen-laptop
    await expect(page.locator('body')).not.toHaveClass(/screen-laptop/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Help panel (F-052)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Help panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('amc_screen', 'desktop'));
    await page.reload();
  });

  test('? button in topbar opens help panel', async ({ page }) => {
    await page.locator('#help-btn').click();
    await expect(page.locator('#help-panel')).toHaveClass(/open/);
  });

  test('clicking outside closes help panel', async ({ page }) => {
    await page.locator('#help-btn').click();
    await expect(page.locator('#help-panel')).toHaveClass(/open/);
    // Click on main workspace area (outside panel)
    await page.locator('#workspace').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#help-panel')).not.toHaveClass(/open/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard renders
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('amc_screen', 'desktop'));
    await page.reload();
  });

  test('topbar is visible with branding', async ({ page }) => {
    await expect(page.locator('#topbar')).toBeVisible();
    await expect(page.locator('.brand')).toContainText('MISSION CONTROL');
  });

  test('simulation sessions appear in tabs', async ({ page }) => {
    // Give sim a moment to register sessions
    await page.waitForTimeout(500);
    const tabs = page.locator('#session-tabs');
    await expect(tabs).toBeVisible();
    // At least one session tab should exist
    const tabCount = await tabs.locator('.tab').count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
  });

  test('workspace pane renders', async ({ page }) => {
    await expect(page.locator('#workspace .pane')).toBeVisible();
  });
});
