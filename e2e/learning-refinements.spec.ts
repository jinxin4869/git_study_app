import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

async function choose(page: Page, title: string) {
  await page.getByLabel('学習コース').selectOption('all');
  await page.getByLabel('演習を検索').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
}
async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command); await input.press('Enter');
}
test.beforeEach(({ page }) => { page.on('pageerror', error => { throw error; }); });

test('terminal follows locally, suspends while reading old output, resumes explicitly and resets its session', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3');
  for (let i = 0; i < 18; i++) await run(page, 'git status');
  const log = page.getByRole('region', { name: '端末出力' });
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(25);
  await page.getByRole('textbox', { name: '演習コマンド' }).fill('git status');
  await log.evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('button', { name: '過去の出力を表示中 · 最新の出力へ戻る' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => window.scrollY);
  const information = page.getByRole('region', { name: '演習の説明と操作案内' });
  const informationTop = await information.evaluate(element => element.scrollTop);
  // Submit without focus/click scrolling to isolate the app's output-following behavior.
  await page.getByRole('textbox', { name: '演習コマンド' }).evaluate(element => element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await expect(page.getByRole('button', { name: '新しい出力があります · 最新の出力へ戻る' })).toHaveCount(1);
  expect(await log.evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect(await information.evaluate(element => element.scrollTop)).toBe(informationTop);
  const latest = page.getByRole('button', { name: /最新の出力へ戻る/ });
  await latest.focus(); await latest.press('Enter');
  await expect(latest).toBeFocused();
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(25);
  await log.evaluate(element => { element.scrollTop = 0; });
  await expect(latest).toContainText('過去の出力');
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  expect(await log.evaluate(element => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await expect(latest).not.toContainText('過去の出力');
  await run(page, 'clear');
  await expect(log).toHaveText('');
});

test('authored hints, preparation, completion evidence and recommended next lesson remain optional', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'ステージ後の再編集');
  await expect(page.getByRole('heading', { name: 'なぜ達成したか' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '1. 考え方' })).toHaveCount(0);
  await page.getByText('この演習の前提', { exact: true }).click();
  await expect(page.getByText('各演習は独立した初期状態から始まります。前の演習の途中状態や完了は必要ありません。')).toBeVisible();
  await run(page, 'git commit -m "Record version 2"');
  const explanation = page.getByRole('region', { name: '完了後の解説' });
  await expect(explanation).toContainText('commitはindexのversion 2を記録し、後のversion 3は未記録で残ります。');
  await explanation.getByText('達成時に満たした条件', { exact: true }).click();
  await expect(explanation).toContainText('HEADのファイル内容');
  // Long explanation remains in its own scroller and cannot push log controls below the input.
  const log = page.getByRole('region', { name: '端末出力' });
  const logBox = await log.boundingBox();
  const latestBox = await page.getByRole('button', { name: /最新の出力へ戻る/ }).boundingBox();
  const inputBox = await page.getByRole('textbox', { name: '演習コマンド' }).boundingBox();
  expect(logBox!.height).toBeGreaterThanOrEqual(80);
  expect(logBox!.y + logBox!.height).toBeLessThanOrEqual(latestBox!.y + 1);
  expect(latestBox!.y + latestBox!.height).toBeLessThanOrEqual(inputBox!.y);
  await run(page, 'echo "Later edit" > app.ts');
  await expect(explanation).toContainText('version 2');
  await explanation.getByRole('button', { name: /次のおすすめ: ステージだけを解除/ }).click();
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'なぜ達成したか' })).toHaveCount(0);
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  await expect(page.getByText('ステージの解除はindexを戻す操作です。作業ツリーのversion 2は残します。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4. 解答例' })).toHaveCount(0);
});

test('wrong file commits and ignored options do not complete lessons or write completion records', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-5');
  for (const command of ['git restore --staged README.md', 'touch other.txt', 'git add other.txt', 'git commit -m "Other"']) await run(page, command);
  await expect(page.getByRole('list', { name: '達成条件' })).toContainText('未達: HEADに記録するファイル');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('git-learning:v1:complete:level-1-5'))).toBeNull();
  await choose(page, 'Level 1-6');
  await run(page, 'git log --not-a-real-option');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('未対応のオプション');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await run(page, 'git log');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
});

test('unsaved hint depth survives a reset and retry saves the highest used stage', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, 'allowSave', { value: false, writable: true });
    Storage.prototype.setItem = function(key, value) { if (!(window as unknown as { allowSave: boolean }).allowSave) throw new DOMException('full', 'QuotaExceededError'); original.call(this, key, value); };
  });
  await page.goto('/game'); await choose(page, 'Level 1-5');
  for (const [index, title] of ['考え方', '確認方法', 'コマンド', '解答例'].entries()) await page.getByRole('button', { name: `ヒント ${index + 1}: ${title}を開く` }).click();
  await page.getByRole('button', { name: '現在の演習を最初からやり直す' }).click();
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  await page.evaluate(() => { (window as unknown as { allowSave: boolean }).allowSave = true; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('git-learning:v1:hint:level-1-5')!).level)).toBe(4);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('storage access recovery reloads previously saved completions in the same page', async ({ page }) => {
  await page.addInitScript(() => {
    const storage = window.localStorage;
    storage.setItem('git-learning:v1:complete:level-1-3', JSON.stringify({ version: 1, id: 'level-1-3', completedAt: 123 }));
    Object.defineProperty(window, 'allowRead', { value: false, writable: true });
    Object.defineProperty(window, 'localStorage', { get() { if (!(window as unknown as { allowRead: boolean }).allowRead) throw new DOMException('denied', 'SecurityError'); return storage; } });
  });
  await page.goto('/game');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('アクセスできません');
  await page.evaluate(() => { (window as unknown as { allowRead: boolean }).allowRead = true; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await choose(page, 'Level 1-3');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
});

test('revoked storage access during a cross-tab event reports failure without crashing or losing the current lesson', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await page.evaluate(() => {
    const storage = window.localStorage;
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('revoked', 'SecurityError'); } });
    window.dispatchEvent(new StorageEvent('storage', { key: 'git-learning:v1:complete:level-1-5', storageArea: storage }));
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { return storage; } });
  });
  await expect(page.getByRole('main').getByRole('alert')).toContainText('アクセスできません');
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await page.getByRole('button', { name: '保存を再試行' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await run(page, 'git status');
  await expect(page.getByRole('region', { name: '端末出力' })).toContainText('On branch main');
});

test('free practice is reachable, preserves records and resets the exercise selection', async ({ page }) => {
  await page.goto('/game'); await choose(page, 'Level 1-3'); await run(page, 'git status');
  await page.getByRole('button', { name: '自由練習に切り替える' }).click();
  await expect(page.getByRole('list', { name: '達成条件' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('list', { name: '達成条件' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Level 1-3/ })).toContainText('完了済み');
  await page.getByRole('button', { name: '基本操作から始める' }).click();
  await expect(page.getByRole('button', { name: /Level 1-1: リポジトリ/ })).toHaveAttribute('aria-pressed', 'true');
});

test('reduced motion shows content immediately and graph has a textual history description', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gitを操作して学ぶ' })).toBeVisible();
  await expect(page.getByRole('link', { name: '学習を始める' })).toHaveCSS('opacity', '1');
  await page.getByRole('link', { name: '学習を始める' }).click();
  await choose(page, 'Level 3-5');
  const graph = page.getByRole('img', { name: 'コミットの親子とブランチの位置' });
  await expect(graph.locator('desc')).toContainText('ブランチ main は c4');
  await expect(graph.locator('desc')).toContainText('親はc2');
  await run(page, 'git merge feature2');
  await expect(graph.locator('g').first()).toHaveCSS('opacity', '1');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
});

test('landscape, 200 percent text and forced colors keep controls reachable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gitを操作して学ぶ' })).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('link', { name: '学習を始める' }).click();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await choose(page, 'Level 1-5');
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  await run(page, 'git commit -m "First commit"');
  await expect(page.getByRole('region', { name: '完了後の解説' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: '演習コマンド' }).focus();
  await expect(page.getByRole('textbox', { name: '演習コマンド' })).toBeFocused();
});

async function accessibilityCheck(page: Page) {
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run(context: Document, options: unknown): Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }));
  });
  expect(violations).toEqual([]);
}
test('automated accessibility checks cover home, hints, completed lesson, conflict panel and save failure', async ({ page }) => {
  await page.goto('/'); await accessibilityCheck(page);
  await page.goto('/game'); await choose(page, 'Level 1-5');
  await page.getByRole('button', { name: 'ヒント 1: 考え方を開く' }).click();
  await accessibilityCheck(page);
  await run(page, 'git commit -m "First commit"'); await accessibilityCheck(page);
  await choose(page, 'Level 7-3'); await page.getByRole('button', { name: 'index.htmlを開く' }).click();
  await accessibilityCheck(page);
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('git-learning:v1:selection', '{'));
  await page.reload(); await accessibilityCheck(page);
});
