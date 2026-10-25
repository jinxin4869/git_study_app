import { test, expect, type Page } from '@playwright/test';
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test('clean preview explains untracked candidates without deleting files', async ({ page }) => {
  await page.goto('/game?lesson=free');
  for (const command of ['echo "base" > src/app.ts', 'echo "ignored.log" > .gitignore', 'git add .', 'git commit -m "Root"', 'echo "memo" > notes.txt', 'echo "extra" > scratch/a.txt', 'echo "ignored" > ignored.log', 'clear']) await run(page, command);
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill('git cle'); await input.press('Tab'); await expect(input).toHaveValue('git clean ');
  await run(page, 'git clean -n');
  const output = page.getByRole('region', { name: '端末出力' });
  await expect(output).toContainText('Would remove "notes.txt"');
  await expect(output).not.toContainText('scratch/a.txt');
  await run(page, 'clear'); await run(page, 'git clean -nd');
  await expect(output).toContainText('Would remove "scratch/a.txt"');
  await expect(output).not.toContainText('ignored.log');
  await run(page, 'git clean -f'); await expect(output).toContainText('未対応のオプション');
  await page.getByRole('button', { name: 'notes.txtを開く' }).click();
  await expect(page.locator('pre')).toHaveText('memo');
  await page.getByRole('button', { name: 'プレビューを閉じる' }).click();
  await page.getByRole('button', { name: 'scratchフォルダ' }).click();
  await page.getByRole('button', { name: 'scratch/a.txtを開く' }).click();
  await expect(page.locator('pre')).toHaveText('extra');
  await page.getByRole('button', { name: 'プレビューを閉じる' }).click();
  await page.getByRole('button', { name: 'ignored.logを開く' }).click();
  await expect(page.locator('pre')).toHaveText('ignored');
  await run(page, 'git status'); await expect(output).toContainText('notes.txt');
});
