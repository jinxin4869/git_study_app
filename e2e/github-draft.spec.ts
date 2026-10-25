import { test, expect, type Page } from '@playwright/test';
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test('a Draft cannot merge with passing checks until explicitly marked ready', async ({ page }) => {
  await page.goto('/game?lesson=github-merge');
  const output = page.getByRole('region', { name: '端末出力' });
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill('gh pr rea'); await input.press('Tab'); await expect(input).toHaveValue('gh pr ready ');
  await input.fill('gh pr ready 1 --u'); await input.press('Tab'); await expect(input).toHaveValue('gh pr ready 1 --undo ');
  await input.press('Enter');
  for (const command of ['simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge']) await run(page, command);
  await expect(output).toContainText('Draft PRはマージできません。');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '現在の途中状態を保存', exact: true }).click();
  await page.reload();
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '保存した途中状態を再開', exact: true }).click();
  await run(page, 'gh pr view 1'); await expect(output).toContainText('Draft・下書き');
  for (const command of ['gh pr ready 1', 'gh pr merge 1 --merge']) await run(page, command);
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
});
