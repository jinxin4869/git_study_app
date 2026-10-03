import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3111',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'narrow', use: { browserName: 'chromium', viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3111',
    url: 'http://127.0.0.1:3111',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
