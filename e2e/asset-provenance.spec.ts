import { test, expect } from '@playwright/test';

test('fonts are self-hosted and the active icon uses the recorded SVG source', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'font') fontRequests.push(request.url()); });
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(fontRequests.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  for (const url of fontRequests) { expect(new URL(url).origin).toBe(origin); expect(new URL(url).pathname).toMatch(/^\/fonts\/[a-f0-9]{64}\.woff2$/); }
  expect((await page.request.get(fontRequests[0])).headers()['cache-control']).toContain('immutable');
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(icon).toContain('/icon.svg');
  const response = await page.request.get(icon!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Git Learning App');
  expect((await page.request.get('/icon.png')).status()).toBe(404);
  const inventory = await page.request.get('/licenses/dependencies/linux-x64.json');
  expect(inventory.status()).toBe(200);
  expect((await inventory.json()).packages.length).toBeGreaterThan(0);
});
