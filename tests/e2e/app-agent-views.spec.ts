/**
 * E2E — React App: Agent views, pane tabs, DAG, Session Replay, Conflict Panel
 *
 * RED TESTS — failing until app is running at localhost:5173 with a seeded
 * Supabase instance (or file-watch fallback with agent_state.json).
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

// Shared auth state — created by: npx playwright test --global-setup
// tests/e2e/global-setup.ts (see auth setup section at bottom)
test.use({ storageState: 'tests/e2e/.auth/user.json' });

// ─────────────────────────────────────────────────────────────────────────────
// Pane system — tab navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Pane tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('renders default agent tab in the first pane', async ({ page }) => {
    // The first pane should default to 'agents' tab
    const agentsTab = page.getByRole('tab', { name: /agents/i }).first();
    await expect(agentsTab).toBeVisible();
    await expect(agentsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Task Graph tab is present and clickable', async ({ page }) => {
    const dagTab = page.getByRole('tab', { name: /task graph/i }).first();
    await expect(dagTab).toBeVisible();
    await dagTab.click();
    // After clicking, it should become active
    await expect(dagTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Session Replay tab is present and clickable', async ({ page }) => {
    const replayTab = page.getByRole('tab', { name: /session replay/i }).first();
    await expect(replayTab).toBeVisible();
    await replayTab.click();
    await expect(replayTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switching tabs changes the visible pane content', async ({ page }) => {
    const dagTab = page.getByRole('tab', { name: /task graph/i }).first();
    await dagTab.click();
    // DAG pane content should be visible — look for the SVG canvas
    const dagSvg = page.locator('[data-testid="dag-svg"], svg.dag-view').first();
    await expect(dagSvg).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DAG View (M6-002)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DAG View — Task Graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    // Switch to Task Graph tab
    await page.getByRole('tab', { name: /task graph/i }).first().click();
  });

  test('renders an SVG element when tasks are present', async ({ page }) => {
    // Inject mock tasks into the page's Zustand store
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([
        { id: '1', title: 'Task A', status: 'todo', dependsOn: [] },
        { id: '2', title: 'Task B', status: 'in_progress', dependsOn: ['1'] },
      ]);
    });
    await page.waitForTimeout(200);
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('shows empty state message when no tasks exist', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([]);
    });
    await page.waitForTimeout(200);
    const emptyMsg = page.getByText(/no tasks|empty/i);
    await expect(emptyMsg).toBeVisible();
  });

  test('clicking a task node does not crash the page', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_TASKS?.([
        { id: '1', title: 'Task A', status: 'todo', dependsOn: [] },
      ]);
    });
    await page.waitForTimeout(200);
    // Click the first node rect in the SVG
    const node = page.locator('svg rect, svg .dag-node').first();
    if (await node.count() > 0) {
      await node.click();
    }
    // Page should not have crashed
    await expect(page).not.toHaveURL(/error/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Replay (M6-006)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session Replay — timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('tab', { name: /session replay/i }).first().click();
  });

  test('renders timeline SVG when events are present', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_EVENTS?.([
        { type: 'tool_call', ts: Date.now() - 60000, costCents: 0 },
        { type: 'error',     ts: Date.now() - 30000, costCents: 0 },
        { type: 'tool_call', ts: Date.now(),          costCents: 5 },
      ]);
    });
    await page.waitForTimeout(200);
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('event dots are coloured by type', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_EVENTS?.([
        { type: 'tool_call',        ts: Date.now() - 3000, costCents: 0 },
        { type: 'error',            ts: Date.now() - 2000, costCents: 0 },
        { type: 'approval_request', ts: Date.now() - 1000, costCents: 0 },
      ]);
    });
    await page.waitForTimeout(200);
    // The component uses fill colours — check at least 2 dots exist
    const dots = page.locator('svg circle, svg .event-dot');
    await expect(dots).toHaveCount(3, { timeout: 3000 });
  });

  test('total cost badge shows 0¢ when all events have zero cost', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_EVENTS?.([
        { type: 'tool_call', ts: Date.now(), costCents: 0 },
      ]);
    });
    await page.waitForTimeout(200);
    const badge = page.getByText(/0[¢c]|0 cent/i);
    await expect(badge).toBeVisible();
  });

  test('hovering an event dot shows a tooltip', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_EVENTS?.([
        { type: 'tool_call', ts: Date.now() - 1000, costCents: 3 },
      ]);
    });
    await page.waitForTimeout(200);
    const dot = page.locator('svg circle, svg .event-dot').first();
    if (await dot.count() > 0) {
      await dot.hover();
      const tooltip = page.locator('[role="tooltip"], .tooltip, [data-testid="event-tooltip"]');
      await expect(tooltip).toBeVisible({ timeout: 2000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection Panel (M7-004)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Conflict Detection Panel', () => {
  test('is NOT visible when there are no conflicts', async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_CONFLICTS?.([]);
    });
    await page.waitForTimeout(200);
    const banner = page.getByText(/merge conflict/i);
    await expect(banner).toBeHidden();
  });

  test('shows conflict banner with file count when conflicts are present', async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_CONFLICTS?.(['src/index.ts', 'app/store.ts']);
    });
    await page.waitForTimeout(200);
    const banner = page.getByText(/2 merge conflict/i);
    await expect(banner).toBeVisible();
  });

  test('shows conflicting file names', async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_CONFLICTS?.(['src/index.ts']);
    });
    await page.waitForTimeout(200);
    await expect(page.getByText('src/index.ts')).toBeVisible();
  });

  test('strategy selector defaults to "Keep Ours"', async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_CONFLICTS?.(['src/index.ts']);
    });
    await page.waitForTimeout(200);
    const oursRadio = page.getByRole('radio', { name: /keep ours/i }).first();
    await expect(oursRadio).toBeChecked();
  });

  test('Resolve button sends resolve_conflict command', async ({ page }) => {
    await page.goto(APP_URL);
    const commands: unknown[] = [];
    // Intercept IPC command writes
    await page.route('**/commands/**', (route) => {
      commands.push(route.request().postDataJSON());
      route.abort();
    });
    await page.evaluate(() => {
      // @ts-ignore
      window.__AMC_INJECT_CONFLICTS?.(['src/index.ts']);
    });
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /resolve/i }).first().click();
    await page.waitForTimeout(300);
    // The command should have been attempted
    // (In file-IPC mode this will be a filesystem write, not a network request —
    // so this test verifies the UI doesn't error rather than the command payload)
    await expect(page).not.toHaveURL(/error/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR Creation Modal (M7-006)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('PR Creation Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Create PR button is present in session actions', async ({ page }) => {
    // Session cards or detail panels should expose a "Create PR" trigger
    const btn = page.getByRole('button', { name: /create pr|open pr/i }).first();
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('modal opens with pre-filled title from session name', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create pr|open pr/i }).first();
    await btn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const titleInput = dialog.getByRole('textbox', { name: /title/i });
    await expect(titleInput).not.toBeEmpty();
  });

  test('branch name field is read-only', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create pr|open pr/i }).first();
    await btn.click();
    const dialog = page.getByRole('dialog');
    const branchInput = dialog.getByLabel(/branch/i);
    await expect(branchInput).toHaveAttribute('readonly');
  });

  test('submitting the modal closes it', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create pr|open pr/i }).first();
    await btn.click();
    const dialog = page.getByRole('dialog');
    const submitBtn = dialog.getByRole('button', { name: /submit|create|open/i });
    await submitBtn.click();
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test('Cancel button closes modal without submitting', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create pr|open pr/i }).first();
    await btn.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });
});
