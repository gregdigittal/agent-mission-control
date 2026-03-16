// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  // Global setup: creates tests/e2e/.auth/user.json with a logged-in session
  // Run once before the app-* spec files. Requires E2E_TEST_EMAIL + E2E_TEST_PASSWORD env vars.
  // globalSetup: './tests/e2e/global-setup.ts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── MVP Dashboard (port 8090, python http.server) ──────────────────────
    {
      name: 'dashboard-chromium',
      testMatch: '**/dashboard.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8090',
      },
    },

    // ── React App (port 5173, Vite dev server) ─────────────────────────────
    // Auth setup: run `npx playwright test --project=app-setup` once to create
    // tests/e2e/.auth/user.json, then run the app-* specs.
    {
      name: 'app-setup',
      testMatch: '**/global-setup.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
    {
      name: 'app-chromium',
      testMatch: '**/app-*.spec.ts',
      dependencies: ['app-setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
    {
      name: 'app-mobile',
      testMatch: '**/app-*.spec.ts',
      dependencies: ['app-setup'],
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5173',
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
  ],

  webServer: [
    // Dashboard server
    {
      command: 'python3 -m http.server 8090',
      url: 'http://localhost:8090',
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
      cwd: './dashboard',
    },
    // React app dev server (only started when app-* projects run)
    // Comment this out if you prefer to start the dev server manually.
    // {
    //   command: 'npm run dev',
    //   url: 'http://localhost:5173',
    //   reuseExistingServer: !process.env.CI,
    //   timeout: 30000,
    //   cwd: './app',
    //   env: {
    //     VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
    //     VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
    //   },
    // },
  ],
});
