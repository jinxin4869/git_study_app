import { test, expect, type Page } from '@playwright/test';

async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test('origin attribution survives a saved conflict and remains visible after continue', async ({ page }) => {
  await page.goto('/game?lesson=free');
  for (const command of [
    'echo "base" > app.ts', 'git add .', 'git commit -m "Root"',
    'git switch -c feature', 'echo "feature" > app.ts', 'git add .', 'git commit -m "Feature"',
    'git switch main', 'echo "main" > app.ts', 'git add .', 'git commit -m "Main"',
    'clear', 'git show feature',
  ]) await run(page, command);
  const output = page.getByRole('region', { name: '端末出力' });
  const source = (await output.innerText()).match(/commit ([a-z0-9]+)/)![1];
  await run(page, 'git cherry-pick -x feature');
  await expect(page.getByRole('button', { name: 'app.tsを開く' })).toBeVisible();
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '現在の途中状態を保存', exact: true }).click();
  await expect(page.getByText('現在の途中状態を保存しました。', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '保存した途中状態を再開', exact: true }).click();
  for (const command of ['echo "Resolved" > app.ts', 'git add app.ts', 'git cherry-pick --continue', 'clear', 'git log']) await run(page, command);
  await expect(output).toContainText(`(cherry picked from commit ${source})`);
  await page.getByRole('button', { name: 'app.tsを開く' }).click();
  await expect(page.locator('pre')).toHaveText('Resolved');
});
