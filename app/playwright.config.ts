import { defineConfig, devices } from '@playwright/test';

/**
 * Agent Mission Control — Playwright E2E configuration.
 *
 * Tests live in e2e/ and run against the Vite dev server (started automatically).
 * Critical flows covered:
 *   - Auth (login gate, redirect, session persistence)
 *   - Dashboard (loads, session tabs render)
 *   - Kanban (column layout, drag indicator present)
 *   - Cost (billing figures show)
 *   - Offline fallback (Supabase unavailable banner)
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
