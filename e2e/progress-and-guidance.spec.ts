import { test, expect, type Page } from '@playwright/test';
const prefix = 'git-learning:v1:';
async function choose(page: Page, title: string) {
  await page.getByLabel('学習コース').selectOption('all');
  await page.getByLabel('演習を検索').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
}
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
async function deleteRecords(page: Page, scope: 'all' | 'current') {
  await page.getByText('保存と再開', { exact: true }).click();
  await page.getByRole('button', { name: scope === 'all' ? 'すべての保存記録を削除' : 'この演習の保存記録を削除' }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

test('learn without hints, persist completion and filters, restore only exercise selection', async ({ page }) => {
  await page.goto('/game');
  await choose(page, 'Level 1-3');
  await expect(page.getByText('解答例', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Hint:', { exact: false })).toHaveCount(0);
  await page.getByLabel('学習コース').selectOption({ label: '基本操作' });
  await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  await run(page, 'echo "unsaved Git state" > README.md');
  await page.reload();
  await expect(page.getByLabel('演習を検索')).toHaveValue('Level 1-3');
  await expect(page.getByLabel('学習コース')).toHaveValue('基本操作');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'README.mdを開く' }).click();
  await expect(page.locator('pre')).toHaveText('');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(page.getByRole('button', { name: 'README.mdを開く' })).toBeFocused();
});

test('hints open in four stages and always start closed on reset or reload', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-5');
  for (const [i, title] of ['考え方', '確認方法', 'コマンド', '解答例'].entries()) {
    await page.getByRole('button', { name: `ヒント ${i + 1}: ${title}を開く` }).click();
    await expect(page.getByRole('heading', { name: `${i + 1}. ${title}` })).toBeVisible();
    if (i < 3) await expect(page.getByText('git commit -m "First commit"', { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText('git commit -m "First commit"', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).level, `${prefix}hint:level-1-5`)).toBe(4);
  await page.reload();
  await expect(page.getByRole('button', { name: 'ヒント 1: 考え方を開く' })).toBeVisible();
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await expect(page.getByRole('button', { name: 'ヒント 1: 考え方を開く' })).toBeVisible();
});

test('reset preserves completion; per-exercise deletion and full deletion do not reset Git', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await run(page, 'echo "keep current" > README.md');
  await deleteRecords(page, 'current');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).not.toContainText('完了済み');
  await page.getByRole('button', { name: 'README.mdを開く' }).click();
  await expect(page.locator('pre')).toHaveText('keep current');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toHaveAttribute('aria-pressed', 'true');
  await deleteRecords(page, 'all');
  await page.reload();
  await expect(page.getByRole('list', { name: '達成条件' })).toHaveCount(0);
});

test('invalid ids and corrupt records show recovery without crashing', async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key + 'selection', JSON.stringify({ version: 1, lastId: '__proto__', category: 'no', search: '' }));
    localStorage.setItem(key + 'complete:level-1-3', '{');
  }, prefix);
  await page.goto('/game');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('演習IDが無効');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('保存データ');
  await choose(page, 'Level 1-3'); await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('unknown format is preserved until explicit deletion', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key + 'selection', '{"version":99,"future":"keep"}'), prefix);
  await page.goto('/game'); await choose(page, 'Level 1-3');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('未対応');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key + 'selection')!).future, prefix)).toBe('keep');
  await deleteRecords(page, 'all');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
});

test('quota failure retains in-memory achievement and retry saves it', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'allowSave', { value: false, writable: true });
    Storage.prototype.setItem = function(key, value) {
      if (!(window as unknown as { allowSave: boolean }).allowSave) throw new DOMException('full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('容量');
  await page.evaluate(() => { (window as unknown as { allowSave: boolean }).allowSave = true; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), `${prefix}complete:level-1-3`)).toBeTruthy();
});

test('two tabs complete independently, observe deletions and do not change each other’s exercise', async ({ page, context }) => {
  const second = await context.newPage();
  await page.goto('/game'); await second.goto('/game');
  await choose(page, 'Level 1-3'); await choose(second, 'Level 1-2');
  await Promise.all([run(page, 'git status'), run(second, 'touch README.md')]);
  await expect(page.getByText('2 完了', { exact: false })).toBeVisible();
  await expect(second.getByText('2 完了', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toHaveAttribute('aria-pressed', 'true');
  await deleteRecords(second, 'all');
  await expect(page.getByText('0 完了', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('list', { name: '達成条件' })).toHaveCount(0);
});

test('IME composition and keyCode 229 do not submit, command attributes are appropriate', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3');
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill('git status');
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await expect(input).toHaveValue('git status');
  await input.dispatchEvent('compositionend');
  const prevented = await input.evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })));
  expect(prevented).toBe(true);
  await input.press('Enter');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  for (const [name, value] of [['autocapitalize', 'none'], ['autocorrect', 'off'], ['autocomplete', 'off'], ['spellcheck', 'false']]) await expect(input).toHaveAttribute(name, value);
  await expect(page.getByRole('status').filter({ hasText: '達成条件を満たしました' })).toBeAttached();
});

test('failed attempts explain unmet requirements and operation actions populate usable input', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3');
  await run(page, 'git status --not-a-real-option');
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達: 最後の操作');
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await choose(page, 'Level 7-1'); await run(page, 'git merge feature');
  const guide = page.getByRole('region', { name: '操作中の状態' });
  await expect(guide).toContainText('merge 中');
  await guide.getByRole('button', { name: 'git merge --abort', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toHaveValue('git merge --abort');
  await page.keyboard.press('Enter');
  await expect(guide).toHaveCount(0);
});

test('keyboard opens and closes nested previews and conflict panels with focus restored', async ({ page }) => {
  await page.goto('/game');
  await run(page, 'echo "focus" > folder/file.txt');
  await page.getByRole('button', { name: 'folderフォルダ' }).focus(); await page.keyboard.press('Enter');
  const file = page.getByRole('button', { name: 'folder/file.txtを開く' });
  await file.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close preview' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(file).toBeFocused();
  await choose(page, 'Level 7-3');
  const conflict = page.getByRole('button', { name: 'index.htmlを開く' });
  await conflict.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(conflict).toBeFocused();
});

test('denied storage keeps the exercise usable and reports unsaved completion', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  await page.goto('/game');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('保存領域');
  await choose(page, 'Level 1-3'); await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('保存領域');
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('アクセスできません');
});

test('keyboard search, selection, hint and missing-file focus fallback', async ({ page }) => {
  await page.goto('/game');
  const search = page.getByLabel('演習を検索');
  await search.focus(); await page.keyboard.type('Level 1-3');
  await page.keyboard.press('Tab'); // Closed save disclosure.
  await page.keyboard.press('Tab'); // The sole search result.
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
  const hint = page.getByRole('button', { name: 'ヒント 1: 考え方を開く' });
  await hint.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '1. 考え方' })).toBeVisible();
  await page.getByRole('button', { name: 'README.mdを開く' }).focus(); await page.keyboard.press('Enter');
  await run(page, 'rm README.md');
  await page.getByRole('button', { name: 'Close preview' }).focus(); await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
});
