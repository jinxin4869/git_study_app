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

test('public terminal suspends following while reading old output and resumes on demand', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3');
  for (let i = 0; i < 18; i++) await run(page, 'git status');
  const log = page.getByRole('region', { name: '端末出力' });
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(25);
  await command(page).fill('git status');
  await log.evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('button', { name: '過去の出力を表示中 · 最新の出力へ戻る' })).toBeVisible();
  await command(page).evaluate(element => element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await expect(page.getByRole('button', { name: '新しい出力があります · 最新の出力へ戻る' })).toBeVisible();
  expect(await log.evaluate(element => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: /最新の出力へ戻る/ }).click();
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(25);
});

test('public authored completion explanation and next lesson work without hints', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'ステージ後の再編集');
  await expect(page.getByRole('heading', { name: '1. 考え方' })).toHaveCount(0);
  await page.getByText('この演習の前提', { exact: true }).click();
  await expect(page.getByText('各演習は独立した初期状態から始まります。前の演習の途中状態や完了は必要ありません。')).toBeVisible();
  await run(page, 'git commit -m "Record version 2"');
  const explanation = page.getByRole('region', { name: '完了後の解説' });
  await expect(explanation).toContainText('commitはindexのversion 2を記録し、後のversion 3は未記録で残ります。');
  await explanation.getByText('達成時に満たした条件', { exact: true }).click();
  await expect(explanation).toContainText('HEADのファイル内容');
  await explanation.getByRole('button', { name: /次のおすすめ: ステージだけを解除/ }).click();
  await expect(command(page)).toBeFocused();
  await expect(page.getByRole('heading', { name: 'なぜ達成したか' })).toHaveCount(0);
});

test('public failed storage reads retain completions and recover on retry', async ({ page }) => {
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
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await page.evaluate(() => { (window as unknown as { allowRead: boolean }).allowRead = true; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
});

test('public invalid merge and ordinary marker text cannot record a conflict achievement', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 7-1');
  await run(page, 'git merge feature missing-reference');
  await run(page, 'echo "<<<<<<< HEAD" > index.html');
  await expect(page.getByRole('region', { name: '操作中の状態' })).toHaveCount(0);
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達:');
  expect(await page.evaluate(() => localStorage.getItem('git-learning:v1:complete:level-7-1'))).toBeNull();
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await run(page, 'git merge feature');
  await expect(page.getByRole('region', { name: '操作中の状態' })).toContainText('merge 中');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: '達成条件' })).not.toContainText('未達:');
});

test('public stash conflict requires resolved contents and staging before achievement', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'stash復元時の競合');
  await expect(page.getByRole('heading', { name: '1. 考え方' })).toHaveCount(0);
  await run(page, 'git stash pop');
  const guidance = page.getByRole('region', { name: '操作中の状態' });
  await expect(guidance).toContainText('未解消の競合');
  await expect(guidance).toContainText('元の保管は残ります');
  await expect(guidance.getByRole('button', { name: 'git stash --abort' })).toHaveCount(0);
  await run(page, 'echo "Combined" > app.ts');
  await expect(guidance).toBeVisible();
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達:');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('git-learning:v1:complete:stash-conflict'))).toBeNull();
  await guidance.getByRole('button', { name: 'git status', exact: true }).click();
  await command(page).press('Enter');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('Unmerged paths:');
  await run(page, 'git add app.ts');
  await expect(guidance).toHaveCount(0);
  await expect(page.getByRole('list', { name: '達成条件' })).not.toContainText('未達:');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
  await run(page, 'git stash list');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('stash@{0}');
});
