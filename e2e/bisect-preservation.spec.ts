import { test, expect, type Page } from '@playwright/test';
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test('bisect reset preserves investigation commits, tags and stash after a saved checkpoint', async ({ page }) => {
  await page.goto('/game?lesson=advanced-bisect-find');
  for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'echo "investigation" > app.ts', 'git add app.ts', 'git commit -m "Investigation"', 'git tag investigation', 'echo "private stash" > app.ts', 'git stash push']) await run(page, command);
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '現在の途中状態を保存', exact: true }).click();
  await page.reload();
  await page.getByText('途中状態・バックアップ', { exact: true }).click();
  await page.getByRole('button', { name: '保存した途中状態を再開', exact: true }).click();
  for (const command of ['git bisect reset', 'clear', 'git show investigation', 'git stash list']) await run(page, command);
  const output = page.getByRole('region', { name: '端末出力' });
  await expect(output).toContainText('Investigation');
  await expect(output).toContainText('stash@{0}');
  await run(page, 'git switch --detach investigation');
  await page.getByRole('button', { name: 'app.tsを開く' }).click();
  await expect(page.locator('pre')).toHaveText('investigation');
});
