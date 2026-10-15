import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/reality-audit',
  timeout: 90 * 1000,
  expect: {
    timeout: 20 * 1000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'playwright-staging-results.json' }]],
  use: {
    baseURL: 'https://vinh-ai-interview.duckdns.org',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
      },
    },
  ],
});
