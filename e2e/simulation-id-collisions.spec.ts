import { test, expect, type Page } from '@playwright/test';
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test('repeated randomness cannot replace earlier commits or break parent navigation', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/game?lesson=free');
  for (const command of [
    'echo "first" > app.ts', 'git add .', 'git commit -m "Root"',
    'echo "second" > app.ts', 'git add .', 'git commit -m "Next"',
    'git commit --amend -m "Amended"', 'clear', 'git log',
  ]) await run(page, command);
  const output = page.getByRole('region', { name: '端末出力' });
  await expect(output).toContainText('Root');
  await expect(output).toContainText('Amended');
  const description = page.getByRole('img', { name: 'コミットの親子とブランチの位置' }).locator('desc');
  for (const message of ['Root', 'Next', 'Amended']) await expect(description).toContainText(message);
  await run(page, 'git reset --hard HEAD~1');
  await page.getByRole('button', { name: 'app.tsを開く' }).click();
  await expect(page.locator('pre')).toHaveText('first');
});
