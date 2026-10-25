import { test, expect, type Page } from '@playwright/test';
async function run(page: Page, command: string) { const input=page.getByRole('textbox',{name:'演習コマンド'});await input.fill(command);await input.press('Enter'); }
async function transfer(page: Page) { await page.getByText('途中状態・バックアップ',{exact:true}).click(); }

test('three areas show different staged and unstaged content without changing the file',async({page})=>{
  await page.goto('/game?lesson=level-1-3');
  for(const command of ['git add .','git commit -m base','echo "stage" > README.md','git add README.md','echo "working" > README.md'])await run(page,command);
  await page.getByRole('button',{name:'README.mdを開く'}).click();
  await page.getByRole('button',{name:'HEAD・ステージ・作業ツリーを比較'}).click();
  const comparison=page.getByRole('region',{name:'3領域の比較'});
  await expect(comparison).toContainText('stage');await expect(comparison).toContainText('working');
  await expect(comparison.getByRole('heading',{name:'HEAD',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'作業ツリーだけ表示'}).click();await expect(page.locator('pre')).toHaveText('working');
});
test('remote references, tags and tracking counts update after fetch',async({page})=>{
  await page.goto('/game?lesson=remote-clone');await run(page,'git clone mock://team/project');
  const graph=page.getByRole('region',{name:'コミットグラフ'});
  await expect(graph).toContainText('origin/main (remote)');await expect(graph).toContainText('ahead 0 / behind 0');
  await run(page,'git tag v1');await expect(graph).toContainText('tag: v1');
  await run(page,'echo "local" > app.ts');await run(page,'git add app.ts');await run(page,'git commit -m Local');await expect(graph).toContainText('ahead 1 / behind 0');
  const overlap=await graph.locator('svg').evaluate(svg=>{const boxes=[...svg.querySelectorAll('rect')].map(rect=>rect.getBBox());return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.x<b.x+b.width && b.x<a.x+a.width && a.y<b.y+b.height && b.y<a.y+a.height));});
  expect(overlap).toBe(false);
});
test('conflict choices preview and manual result editing preserve the stage requirement',async({page})=>{
  await page.goto('/game?lesson=level-7-3');await page.getByRole('button',{name:'index.htmlを開く'}).click();
  const draft=page.getByLabel('解消結果のプレビュー・編集');await expect(draft).toHaveValue(/<<<<<<</);
  await page.getByRole('button',{name:'両方を採用',exact:true}).click();await expect(draft).not.toHaveValue(/<<<<<<</);
  await draft.fill('<html>\n<body>\n<h1>Hello World</h1>\n<h1>Hello Git</h1>\n</body>\n</html>');
  await page.getByRole('button',{name:'解消内容を適用'}).click();await expect(page.getByText('演習を達成しました！',{exact:true})).toBeVisible();
  await run(page,'git status');await expect(page.getByText('Unmerged paths:',{exact:false}).last()).toBeVisible();
});
test('explicit checkpoints resume interactive rebase after reload',async({page})=>{
  await page.goto('/game?lesson=interactive-fixup');await run(page,'git rebase -i HEAD~2');await page.getByLabel('コミットの整理').fill('pick c2\nfixup c3');
  await transfer(page);await page.getByRole('button',{name:'現在の途中状態を保存',exact:true}).click();await expect(page.getByText('現在の途中状態を保存しました。',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel('コミットの整理')).toHaveCount(0);await transfer(page);
  await page.getByRole('button',{name:'保存した途中状態を再開',exact:true}).click();await expect(page.getByLabel('コミットの整理')).toHaveValue('pick c2\nfixup c3');
  await run(page,'git rebase --continue');await expect(page.getByText('演習を達成しました！',{exact:true})).toBeVisible();
});
test('backup download imports progress and a checkpoint into a fresh browser context',async({page,browser})=>{
  await page.goto('/game?lesson=level-1-3');await run(page,'git status');await transfer(page);await page.getByRole('button',{name:'現在の途中状態を保存',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'バックアップを書き出す',exact:true}).click();const download=await downloadPromise;
  const context=await browser.newContext();
  try {const fresh=await context.newPage();await fresh.goto('/game?lesson=level-1-3');await transfer(fresh);await fresh.getByLabel('バックアップを選ぶ').setInputFiles((await download.path())!);await fresh.getByRole('button',{name:'この内容を取り込む',exact:true}).click();await expect(fresh.getByRole('button',{name:/Level 1-3/})).toContainText('完了済み');await fresh.getByRole('button',{name:'保存した途中状態を再開',exact:true}).click();await expect(fresh.getByText('演習を達成しました！',{exact:true})).toBeVisible();}finally{await context.close();}
});
test('lesson URLs support back/forward and completion/difficulty filters',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await run(page,'git status');await page.getByLabel('完了状態',{exact:true}).selectOption('completed');await expect(page.getByRole('button',{name:/Level 1-3/})).toBeVisible();await expect(page.locator('aside').getByRole('button',{name:/Level 1-4/})).toHaveCount(0);
  await page.getByLabel('完了状態',{exact:true}).selectOption('all');await page.getByLabel('難易度',{exact:true}).selectOption('beginner');await page.locator('aside').getByRole('button',{name:/Level 1-4/}).click();await expect(page).toHaveURL(/lesson=level-1-4/);await page.goBack();await expect(page.getByRole('link',{name:'この演習の固定リンク'})).toHaveAttribute('href','?lesson=level-1-3');await page.goForward();await expect(page.getByRole('link',{name:'この演習の固定リンク'})).toHaveAttribute('href','?lesson=level-1-4');
});
test('help does not complete a lesson and knowledge questions explain the answer',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await run(page,'git status --help');await expect(page.getByText('演習を達成しました！',{exact:true})).toHaveCount(0);
  await page.getByText('操作リファレンス・理解度チェック',{exact:true}).click();await page.getByLabel('コマンドリファレンス',{exact:true}).selectOption('restore');await expect(page.getByText(/対応オプション:.*--staged/)).toBeVisible();
  await page.getByLabel('最後にaddした時点の内容',{exact:true}).check();await expect(page.getByText(/正解。commitが記録するのはindex/)).toBeVisible();
  await page.getByRole('link',{name:'自分のPCの実Gitで練習する'}).click();await expect(page.getByRole('heading',{name:'自分のPCの実Gitで練習する'})).toBeVisible();await expect(page.getByText('npm run lab -- setup staging',{exact:true})).toBeVisible();
});

test('invalid backup leaves existing progress and active repository intact',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await run(page,'git status');await run(page,'echo "keep" > notes.txt');await transfer(page);
  await page.getByLabel('バックアップを選ぶ').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'git-learning-backup',version:2,records:[]}))});
  await expect(page.getByText('バックアップの形式・バージョンが不正です。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'この内容を取り込む',exact:true})).toHaveCount(0);
  await expect(page.locator('aside').getByRole('button',{name:/Level 1-3/})).toContainText('完了済み');await page.getByRole('button',{name:'notes.txtを開く'}).click();await expect(page.locator('pre')).toHaveText('keep');
});

test('an old cross-tab deletion notification does not erase a newer lesson URL',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await page.locator('aside').getByRole('button',{name:/Level 1-3/}).click();
  await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'git-learning:v1:selection',newValue:null,storageArea:localStorage})));
  await expect(page).toHaveURL(/lesson=level-1-3/);await expect(page.locator('aside').getByRole('button',{name:/Level 1-3/})).toHaveAttribute('aria-pressed','true');
});

async function importCompletion(page: Page, id: string) {
  await transfer(page);
  const raw=JSON.stringify({format:'git-learning-backup',version:1,records:[[`git-learning:v1:complete:${id}`,JSON.stringify({version:1,id,completedAt:123})]]});
  await page.getByLabel('バックアップを選ぶ').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(raw)});
  await page.getByRole('button',{name:'この内容を取り込む',exact:true}).click();
}

test('returning through browser history persists the last lesson for the next visit',async({page})=>{
  await page.goto('/game');await page.locator('aside').getByRole('button',{name:/Level 1-3/}).click();await page.locator('aside').getByRole('button',{name:/Level 1-4/}).click();await page.goBack();
  await expect(page).toHaveURL(/lesson=level-1-3/);await page.goto('/');await page.getByRole('link',{name:'学習を始める'}).click();
  await expect(page.getByRole('link',{name:'この演習の固定リンク'})).toHaveAttribute('href','?lesson=level-1-3');
});

test('import retains known completions when another progress key cannot be read',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await run(page,'git status');
  await page.evaluate(()=>{const read=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='git-learning:v1:complete:level-1-3')throw new DOMException('denied','SecurityError');return read.call(this,key);};});
  await importCompletion(page,'level-1-2');
  await expect(page.locator('aside').getByRole('button',{name:/Level 1-2/})).toContainText('完了済み');await expect(page.locator('aside').getByRole('button',{name:/Level 1-3/})).toContainText('完了済み');await expect(page.getByRole('main').getByRole('alert')).toContainText('読み取れません');
});

test('import refreshes progress after storage becomes available following initial denial',async({page})=>{
  await page.addInitScript(()=>{const storage=window.localStorage;Object.defineProperty(window,'localStorage',{configurable:true,get(){if(!(window as unknown as {storageAvailable:boolean}).storageAvailable)throw new DOMException('denied','SecurityError');return storage;}});});
  await page.goto('/game?lesson=level-1-3');await page.evaluate(()=>{(window as unknown as {storageAvailable:boolean}).storageAvailable=true;});
  await importCompletion(page,'level-1-2');await expect(page.locator('aside').getByRole('button',{name:/Level 1-2/})).toContainText('完了済み');await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
