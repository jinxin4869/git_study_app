import { test, expect } from '@playwright/test';
test('reviewed difficulty filters include inspection lessons and separate advanced integration', async ({ page }) => {
  await page.goto('/game');
  await expect(page.getByText('難易度は操作の判断量に基づく編集上の分類です。所要時間は未計測の目安です。')).toBeVisible();
  await page.getByLabel('難易度', { exact: true }).selectOption('beginner');
  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('button', { name: /一コミットの変更を確認/ })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /共有する修正と手元の下書きを分ける/ })).toHaveCount(0);
  await page.getByLabel('難易度', { exact: true }).selectOption('intermediate');
  await expect(sidebar.getByRole('button', { name: /PRの差分先と状態を確認/ })).toBeVisible();
  await page.getByLabel('難易度', { exact: true }).selectOption('advanced');
  await expect(sidebar.getByRole('button', { name: /共有する修正と手元の下書きを分ける/ })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /一コミットの変更を確認/ })).toHaveCount(0);
});
