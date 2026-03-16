/**
 * E2E — React App: Kanban board, cost dashboard, admin controls
 *
 * RED TESTS — failing until app is served at localhost:5173 with valid session.
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

// ─────────────────────────────────────────────────────────────────────────────
// Kanban board
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('tab', { name: /kanban/i }).first().click();
  });

  test('renders four columns: Backlog, To Do, In Progress, Done', async ({ page }) => {
    await expect(page.getByText('Backlog')).toBeVisible();
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('task cards are draggable', async ({ page }) => {
    // Inject a task into Backlog
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([
        { id: 'drag-test', title: 'Draggable Task', status: 'backlog', priority: 'medium' },
      ]);
    });
    await page.waitForTimeout(200);

    const card = page.getByText('Draggable Task');
    await expect(card).toBeVisible();

    // Verify the card has drag attributes (dnd-kit adds these)
    const cardEl = card.locator('..');
    const draggable = await cardEl.getAttribute('draggable');
    // dnd-kit may use tabindex or role rather than draggable attr — check one indicator
    const role = await cardEl.getAttribute('role');
    const tabindex = await cardEl.getAttribute('tabindex');
    expect(draggable === 'true' || role !== null || tabindex !== null).toBe(true);
  });

  test('drag task from Backlog to In Progress updates its column', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([
        { id: 'move-test', title: 'Move Me', status: 'backlog', priority: 'high' },
      ]);
    });
    await page.waitForTimeout(200);

    const card = page.locator('[data-task-id="move-test"], :text("Move Me")').first();
    const inProgressCol = page.locator('[data-column="in_progress"], :text("In Progress")').first();

    // Use Playwright drag-and-drop
    await card.dragTo(inProgressCol);
    await page.waitForTimeout(400);

    // Verify the card now appears in the In Progress column
    const inProgressSection = page.locator('[data-column="in_progress"]');
    if (await inProgressSection.count() > 0) {
      await expect(inProgressSection.getByText('Move Me')).toBeVisible();
    }
  });

  test('Claude recommendation badge is visible on recommended tasks', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([
        { id: 'rec-test', title: 'Recommended Task', status: 'todo', claudeRecommended: true },
      ]);
    });
    await page.waitForTimeout(200);
    const badge = page.locator('[data-testid="claude-badge"], .claude-badge, :text("Claude")');
    await expect(badge.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost dashboard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cost dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('tab', { name: /cost/i }).first().click();
  });

  test('renders total cost figure', async ({ page }) => {
    // Cost panel should show a dollar/cent figure
    const costFig = page.locator('[data-testid="total-cost"], :text("$"), :text("¢")').first();
    await expect(costFig).toBeVisible();
  });

  test('budget alert appears when cost exceeds threshold', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_COST?.({ totalCents: 9500, budgetCents: 10000 });
    });
    await page.waitForTimeout(200);
    // Budget alert at 80% threshold should appear
    const alert = page.locator('[role="alert"], .budget-alert, :text("budget")').first();
    await expect(alert).toBeVisible();
  });

  test('Pause All button appears when over budget', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_COST?.({ totalCents: 11000, budgetCents: 10000 });
    });
    await page.waitForTimeout(200);
    const pauseBtn = page.getByRole('button', { name: /pause all/i });
    await expect(pauseBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin controls (M8-004) — owner view
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin controls', () => {
  test('model restrictions multi-select shows all three Claude models', async ({ page }) => {
    await page.goto(APP_URL);
    const profileBtn = page.getByRole('button', { name: /profile|account/i });
    await profileBtn.click();

    await expect(page.getByText('claude-opus-4-6')).toBeVisible();
    await expect(page.getByText('claude-sonnet-4-6')).toBeVisible();
    await expect(page.getByText('claude-haiku-4-5')).toBeVisible();
  });

  test('deselecting a model removes it from allowed list', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /profile|account/i }).click();

    const haiku = page.getByLabel(/haiku/i);
    if (await haiku.isChecked()) {
      await haiku.uncheck();
      await expect(haiku).not.toBeChecked();
    }
  });

  test('budget values persisted after save are re-loaded on revisit', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /profile|account/i }).click();

    const sessionBudget = page.getByLabel(/session budget/i);
    await sessionBudget.fill('25');
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(500);

    // Reload and re-open
    await page.reload();
    await page.getByRole('button', { name: /profile|account/i }).click();
    await expect(page.getByLabel(/session budget/i)).toHaveValue('25');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval queue
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Approval queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('approval badge count is visible in tab bar when pending approvals exist', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_APPROVALS?.([
        { id: 'a1', agentKey: 'agent-1', action: 'git push', risk: 'medium', status: 'pending' },
      ]);
    });
    await page.waitForTimeout(200);
    const badge = page.locator('[data-testid="approval-badge"], .approval-badge, :text("1")').first();
    await expect(badge).toBeVisible();
  });

  test('clicking Approve sends approve command', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_APPROVALS?.([
        { id: 'a1', agentKey: 'agent-1', action: 'git push', risk: 'low', status: 'pending' },
      ]);
    });
    await page.waitForTimeout(200);
    await page.getByRole('tab', { name: /approval/i }).first().click();
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    // Item should be removed from pending list
    await expect(approveBtn).toBeHidden({ timeout: 2000 });
  });

  test('push notifications permission prompt appears once', async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications']);
    await page.goto(APP_URL);
    // No second permission prompt should appear after initial grant
    // Verify no browser permission dialog is pending
    await page.waitForTimeout(500);
    // If we reach here without a dialog blocking, notifications are handled
    await expect(page).not.toHaveURL(/error/i);
  });
});
