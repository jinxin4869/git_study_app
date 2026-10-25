import {test,expect,type Page} from '@playwright/test';
async function run(page:Page,command:string){const input=page.getByRole('textbox',{name:'演習コマンド'});await input.fill(command);await input.press('Enter');}

test('zoom, fit and HEAD navigation affect only the graph viewport',async({page})=>{
  await page.goto('/game?lesson=interactive-fixup');const region=page.getByRole('region',{name:'コミットグラフ'});const svg=region.locator('svg');
  const initial=Number(await svg.getAttribute('width'));await page.getByRole('button',{name:'グラフを拡大',exact:true}).click();expect(Number(await svg.getAttribute('width'))).toBeGreaterThan(initial);
  await page.getByRole('button',{name:'100%に戻す',exact:true}).click();expect(Number(await svg.getAttribute('width'))).toBe(initial);
  await page.getByRole('button',{name:'全体を表示',exact:true}).click();
  const fits=await region.evaluate(element=>{const svg=element.querySelector('svg')!.getBoundingClientRect();return svg.width<=element.clientWidth && svg.height<=element.clientHeight;});expect(fits).toBe(true);
  await page.getByRole('button',{name:'100%に戻す',exact:true}).click();await region.evaluate(element=>{element.scrollLeft=element.scrollWidth;element.scrollTop=element.scrollHeight;});
  await page.getByRole('button',{name:'HEADへ戻る',exact:true}).click();
  const visible=await region.evaluate(element=>{const head=[...element.querySelectorAll('text')].find(text=>text.textContent?.includes('(HEAD)'))!.getBoundingClientRect();const box=element.getBoundingClientRect();return head.left>=box.left && head.right<=box.right && head.top>=box.top && head.bottom<=box.bottom;});expect(visible).toBe(true);
  await expect(page.getByText('演習を達成しました！',{exact:true})).toHaveCount(0);
});

test('commit details reflect the selected snapshot and reset with the exercise',async({page})=>{
  await page.goto('/game?lesson=interactive-fixup');await page.getByLabel('コミットを選ぶ',{exact:true}).selectOption('c2');
  const details=page.getByRole('region',{name:'選択したコミットの詳細'});await expect(details).toContainText('Feature');await expect(details).toContainText('c1');await expect(details).toContainText('変更: app.ts');
  await page.getByLabel('コミットを選ぶ',{exact:true}).selectOption('c3');await expect(details).toContainText('追加: README.md');await expect(details).not.toContainText('変更: app.ts');
  await page.getByRole('button',{name:'グラフを拡大',exact:true}).click();await run(page,'clear');await expect(details).toBeVisible();await expect(page.getByLabel('グラフの拡大率',{exact:true})).toHaveText('125%');
  await page.getByRole('button',{name:'現在の演習を最初からやり直す'}).click();await expect(details).toHaveCount(0);await expect(page.getByLabel('グラフの拡大率',{exact:true})).toHaveText('100%');
  await run(page,'git status');
});
