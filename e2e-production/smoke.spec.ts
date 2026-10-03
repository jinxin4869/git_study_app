import { test, expect, type Page } from '@playwright/test';

const command = (page: Page) => page.getByRole('textbox', { name: '演習コマンド' });
async function choose(page: Page, title: string) {
  await page.getByLabel('学習コース').selectOption('all');
  await page.getByLabel('演習を検索').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
}
async function run(page: Page, input: string) {
  await command(page).fill(input); await command(page).press('Enter');
}
test.beforeEach(({ page, context }) => {
  context.on('page', tab => tab.on('pageerror', error => { throw error; }));
  page.on('pageerror', error => { throw error; });
});

test('public home opens learning and completes a lesson without opening hints', async ({ page }) => {
  const response = await page.goto('/'); expect(response?.status()).toBe(200);
  await page.getByRole('link', { name: /Start Learning|学習を始める/ }).click();
  await expect(command(page)).toBeVisible();
  await choose(page, 'Level 1-5');
  await expect(page.getByRole('heading', { name: '4. 解答例' })).toHaveCount(0);
  await run(page, 'git commit -m "First commit"');
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toContainText('完了済み');
  await expect(page.getByRole('list', { name: '達成条件' })).not.toContainText('未達:');
});

test('public reload restores records and selection, restarts Git and retains completion on reset', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await choose(page, 'Level 1-5'); await run(page, 'git commit -m "First commit"');
  await page.reload();
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toContainText('完了済み');
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達:');
  await run(page, 'git status --not-a-real-option');
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達:');
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toContainText('完了済み');
  await page.getByText('保存と再開', { exact: true }).click();
  await page.getByRole('button', { name: 'この演習の保存記録を削除' }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('button', { name: /Level 1-5/ })).not.toContainText('完了済み');
  await choose(page, 'Level 1-3');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
});

test('public cross-tab completions merge without replacing the other lesson', async ({ page, context }) => {
  await page.goto('/game'); const other = await context.newPage(); await other.goto('/game');
  await choose(page, 'Level 1-3'); await choose(other, 'Level 1-5');
  await run(page, 'git status'); await run(other, 'git commit -m "First commit"');
  await choose(page, 'Level 1-5'); await choose(other, 'Level 1-3');
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toContainText('完了済み');
  await expect(other.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
});

test('public operation guidance matches an executable rebase abort and restores focus after preview', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'rebaseを中断して元へ戻す');
  await run(page, 'git rebase main');
  await expect(page.getByRole('button', { name: 'git rebase --abort', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'app.tsを開く', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'app.tsを開く', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'git rebase --abort', exact: true }).click();
  await expect(command(page)).toHaveValue('git rebase --abort');
  await command(page).press('Enter');
  await expect(page.getByRole('list', { name: '達成条件' })).not.toContainText('未達:');
});
