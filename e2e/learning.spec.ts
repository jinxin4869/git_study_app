import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'Unexpected browser JavaScript errors').toEqual([]);
  }, { auto: true }],
});

async function choose(page: Page, category: string, title: string) {
  await page.getByLabel('学習コース').selectOption({ label: category });
  await page.getByLabel('演習を検索').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
}

async function run(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.fill(command);
  await input.press('Enter');
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function headVisible(page: Page) {
  const graph = page.getByRole('region', { name: 'コミットグラフ' });
  await graph.scrollIntoViewIfNeeded();
  await expect.poll(async () => graph.evaluate(element => {
    const text = [...element.querySelectorAll('text')].find(item => item.textContent?.includes('HEAD'));
    const rect = text?.parentElement?.querySelector('rect');
    if (!rect || !text) return false;
    const viewport = element.getBoundingClientRect();
    const label = rect.getBoundingClientRect();
    const content = text.getBBox();
    const background = rect.getBBox();
    return label.left >= viewport.left && label.right <= viewport.right &&
      label.top >= viewport.top && label.bottom <= viewport.bottom &&
      content.x >= background.x && content.x + content.width <= background.x + background.width;
  })).toBe(true);
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}

test('home footer stays below the start button and navigation works', async ({ page }) => {
  await page.goto('/');
  const start = page.getByRole('link', { name: 'Start Learning' });
  const footer = page.getByText('Built for developers, by developers.', { exact: true });
  await expect(start).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(footer).toHaveCSS('opacity', '1');
  await expect.poll(async () => {
    const button = await start.boundingBox();
    const note = await footer.boundingBox();
    return !!button && !!note && note.y >= button.y + button.height + 16;
  }).toBe(true);
  await noPageOverflow(page);
  await capture(page, 'home');
  await start.click();
  await expect(page.getByLabel('学習コース')).toBeVisible();
});

test('search, empty results, completion, history and reset', async ({ page }) => {
  await page.goto('/game');
  await page.getByLabel('演習を検索').fill('xyz-nonexistent');
  await expect(page.getByText('該当する演習がありません。検索語やコースを変更してください。')).toBeVisible();
  await choose(page, '基本操作', 'Level 1-3');
  await run(page, 'git status');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  const input = page.getByRole('textbox', { name: '演習コマンド' });
  await input.press('ArrowUp');
  await expect(input).toHaveValue('git status');
  const reset = page.getByRole('button', { name: '現在の演習を最初からやり直す' });
  const box = await reset.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'README.mdを開く' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close preview' })).toBeVisible();
  await reset.click();
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await noPageOverflow(page);
});

test('conflict requires a decision and can be resolved and committed', async ({ page }) => {
  await page.goto('/game');
  await choose(page, 'コンフリクト', 'Level 7-1');
  await run(page, 'git merge feature');
  await page.getByRole('button', { name: 'index.htmlを開く' }).click();
  const complete = page.getByRole('button', { name: 'Complete Merge' });
  await expect(complete).toBeDisabled();
  for (const name of ['Cancel', 'Accept Current', 'Accept Incoming', 'Accept Both', 'Complete Merge']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box?.height, name).toBeGreaterThanOrEqual(44);
  }
  await noPageOverflow(page);
  await capture(page, 'conflict');
  await page.getByRole('button', { name: 'Accept Both' }).click();
  await expect(complete).toBeEnabled();
  await complete.click();
  await run(page, 'git add index.html');
  await run(page, 'git commit -m "Resolve"');
  await expect(page.getByRole('region', { name: 'コミットグラフ' }).locator('text').filter({ hasText: /^Resolve$/ })).toBeVisible();
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
});

test('interactive rebase completes and keeps the entire HEAD label visible', async ({ page }) => {
  await page.goto('/game');
  await choose(page, '履歴整理・対話的rebase', '修正コミットを吸収');
  await run(page, 'git rebase -i HEAD~2');
  await page.getByLabel('コミットの整理').fill('pick c2\nfixup c3');
  await run(page, 'git rebase --continue');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
  await headVisible(page);
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const values = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const ratio = (foreground: string, background: string) => {
      const a = luminance(foreground), b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const legend = [...document.querySelectorAll('span')].find(element =>
      ['Mod', 'Staged', 'Conflict'].every(word => element.textContent?.includes(word)))!;
    let surface = legend.parentElement!;
    while (getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)' && surface.parentElement) surface = surface.parentElement;
    const head = [...document.querySelectorAll('[aria-label="コミットグラフ"] text')].find(element => element.textContent?.includes('(HEAD)'))!;
    return {
      legend: ratio(getComputedStyle(legend).color, getComputedStyle(surface).backgroundColor),
      head: ratio(getComputedStyle(head).fill, getComputedStyle(head.parentElement!.querySelector('rect')!).fill),
    };
  });
  expect(contrast.legend).toBeGreaterThanOrEqual(4.5);
  expect(contrast.head).toBeGreaterThanOrEqual(4.5);
  await noPageOverflow(page);
  await capture(page, 'rebase-completed');
});

test('long branch labels fit and detached HEAD remains visible', async ({ page }) => {
  await page.goto('/game');
  await choose(page, '履歴整理・対話的rebase', '修正コミットを吸収');
  await run(page, 'git branch -m feature/long-name');
  await expect(page.getByRole('region', { name: 'コミットグラフ' }).locator('text').filter({ hasText: 'feature/long-name (HEAD)' })).toBeVisible();
  await headVisible(page);
  await run(page, 'git checkout HEAD~1');
  await expect(page.getByRole('region', { name: 'コミットグラフ' }).locator('text').filter({ hasText: /^HEAD$/ })).toBeVisible();
  await headVisible(page);
  await noPageOverflow(page);
});

test('partial staging commits only the selected change', async ({ page }) => {
  await page.goto('/game');
  await choose(page, '日常操作・取り消し', '一ファイルの変更を分けて記録');
  for (const command of ['git add -p app.ts', 'y', 'n', 'git commit -m "Enable feature"']) await run(page, command);
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
});

test('mock PR cannot merge until both approval and CI pass', async ({ page }) => {
  await page.goto('/game');
  await choose(page, 'GitHub・PR・レビュー・CI', '承認とCIを満たしてマージ');
  await run(page, 'gh pr merge 1 --merge');
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await run(page, 'simulate review approve 1');
  await run(page, 'gh pr merge 1 --merge');
  await expect(page.getByText('Level Completed!', { exact: true })).toHaveCount(0);
  await run(page, 'simulate ci pass 1');
  await run(page, 'gh pr merge 1 --merge');
  await expect(page.getByText('Level Completed!', { exact: true })).toBeVisible();
});
