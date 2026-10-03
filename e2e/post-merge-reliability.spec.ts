import { test, expect, type Page } from '@playwright/test';

async function choose(page: Page, title: string) {
  await page.getByLabel('学習コース').selectOption('all');
  await page.getByLabel('演習を検索').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
}
async function run(page: Page, input: string) {
  const field = page.getByRole('textbox', { name: '演習コマンド' });
  await field.fill(input); await field.press('Enter');
}
test.beforeEach(({ page }) => { page.on('pageerror', error => { throw error; }); });

test('a failed storage read retains known completions; a later readable deletion is reflected', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Object.defineProperty(window, 'allowRead', { value: false, writable: true });
    Storage.prototype.getItem = function(key) {
      if (!(window as unknown as { allowRead: boolean }).allowRead) throw new DOMException('revoked', 'SecurityError');
      return original.call(this, key);
    };
    window.dispatchEvent(new StorageEvent('storage', { key: 'git-learning:v1:complete:level-1-5', storageArea: localStorage }));
  });
  await expect(page.getByRole('main').getByRole('alert')).toContainText('保存');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await page.evaluate(() => { (window as unknown as { allowRead: boolean }).allowRead = true; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.removeItem('git-learning:v1:complete:level-1-3');
    window.dispatchEvent(new StorageEvent('storage', { key: 'git-learning:v1:complete:level-1-3', storageArea: localStorage }));
  });
  await expect(page.getByRole('button', { name: /Level 1-3/ })).not.toContainText('完了済み');
});

test('an invalid merge target and ordinary marker text do not record a conflict achievement', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 7-1');
  await run(page, 'git merge feature missing-reference');
  await expect(page.getByRole('region', { name: '操作中の状態' })).toHaveCount(0);
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await run(page, 'echo "<<<<<<< HEAD" > index.html');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('git-learning:v1:complete:level-7-1'))).toBeNull();
  await page.getByRole('button', { name: 'index.htmlを開く' }).click();
  await expect(page.getByRole('button', { name: 'プレビューを閉じる' })).toBeVisible();
  await page.getByRole('button', { name: 'プレビューを閉じる' }).click();
  await expect(page.getByRole('button', { name: 'index.htmlを開く' })).toBeFocused();
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await run(page, 'git merge feature');
  await expect(page.getByRole('region', { name: '操作中の状態' })).toContainText('merge 中');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
});

test('a partial deletion restores records and retries without resetting Git or deleting another lesson', async ({ page }, testInfo) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await choose(page, 'Level 1-5'); await run(page, 'git commit -m "First commit"');
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  await run(page, 'echo "keep this work" > README.md');
  const records = await page.evaluate(() => ({
    complete: localStorage.getItem('git-learning:v1:complete:level-1-5'),
    hint: localStorage.getItem('git-learning:v1:hint:level-1-5'),
  }));
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Object.defineProperty(window, 'allowDelete', { value: false, writable: true });
    Storage.prototype.removeItem = function(key) {
      if (!(window as unknown as { allowDelete: boolean }).allowDelete && key === 'git-learning:v1:hint:level-1-5') throw new DOMException('revoked', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.getByText('保存と再開', { exact: true }).click();
  await page.getByRole('button', { name: 'この演習の保存記録を削除' }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('もう一度削除');
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  const alertBounds = await page.getByRole('main').getByRole('alert').boundingBox();
  const sidebarBounds = await page.getByRole('complementary', { name: '学習する演習' }).boundingBox();
  expect(alertBounds!.y).toBeGreaterThanOrEqual(sidebarBounds!.y);
  expect(alertBounds!.y + alertBounds!.height).toBeLessThanOrEqual(sidebarBounds!.y + sidebarBounds!.height + 1);
  await expect(page.getByRole('button', { name: /Level 1-5/ })).toContainText('完了済み');
  expect(await page.evaluate(() => ({
    complete: localStorage.getItem('git-learning:v1:complete:level-1-5'),
    hint: localStorage.getItem('git-learning:v1:hint:level-1-5'),
  }))).toEqual(records);
  if (['desktop', 'mobile'].includes(testInfo.project.name)) await page.screenshot({ path: testInfo.outputPath('deletion-failure.png'), fullPage: true });
  await page.evaluate(() => { (window as unknown as { allowDelete: boolean }).allowDelete = true; });
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Level 1-5/ })).not.toContainText('完了済み');
  await page.getByRole('button', { name: 'README.mdを開く' }).click();
  await expect(page.getByText('keep this work', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'プレビューを閉じる' }).click();
  await choose(page, 'Level 1-3');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
});

test('stash conflict guidance remains until the edited resolution is staged and then all conditions agree', async ({ page }, testInfo) => {
  await page.goto('/game'); await choose(page, 'stash復元時の競合');
  await expect(page.getByRole('heading', { name: '1. 考え方' })).toHaveCount(0);
  await run(page, 'git stash pop');
  const guidance = page.getByRole('region', { name: '操作中の状態' });
  await expect(guidance).toContainText('未解消の競合');
  await expect(guidance).toContainText('元の保管は残ります');
  await expect(guidance.getByRole('button', { name: 'git stash --abort' })).toHaveCount(0);
  await run(page, 'echo "Combined" > app.ts');
  await expect(guidance).toBeVisible();
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達:');
  expect(await page.evaluate(() => localStorage.getItem('git-learning:v1:complete:stash-conflict'))).toBeNull();
  await guidance.getByRole('button', { name: 'git status', exact: true }).click();
  await page.getByRole('textbox', { name: '演習コマンド' }).press('Enter');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('Unmerged paths:');
  if (['desktop', 'mobile'].includes(testInfo.project.name)) await page.screenshot({ path: testInfo.outputPath('stash-unmerged.png'), fullPage: true });
  await run(page, 'git add app.ts');
  await expect(guidance).toHaveCount(0);
  await expect(page.getByRole('list', { name: '達成条件' })).not.toContainText('未達:');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
  await run(page, 'git stash list');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('stash@{0}');
});
