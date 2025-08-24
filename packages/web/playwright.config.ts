import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for proper setup/teardown
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Always use 1 worker for sequential execution
  reporter: 'html',
  use: {
    baseURL: process.env.WEB_BASE ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    timeout: 30_000,
    // Capture console logs and network activity
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
