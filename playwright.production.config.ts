import { defineConfig } from '@playwright/test';

/** Explicit opt-in smoke tests. No webServer, deployment, real GitHub, or external account writes. */
export default defineConfig({
  testDir: './e2e-production',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  outputDir: 'test-results-production',
  use: {
    baseURL: process.env.PRODUCTION_BASE_URL ?? 'https://git-study-app.vercel.app',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'production-desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'production-mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
