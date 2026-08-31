import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter api start',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PROCESS_ROLE: 'api',
        // The complete parallel walkthrough intentionally exceeds the production
        // per-IP request budget because every browser context shares one Docker IP.
        THROTTLE_LIMIT: process.env.PLAYWRIGHT_THROTTLE_LIMIT || '1000',
        AUTH_REFRESH_THROTTLE_LIMIT: process.env.PLAYWRIGHT_THROTTLE_LIMIT || '1000',
      },
    },
    {
      command: 'pnpm --filter api start:worker',
      port: 9090,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, PROCESS_ROLE: 'worker', WORKER_PORT: '9090' },
    },
    {
      command: 'pnpm --filter web dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
