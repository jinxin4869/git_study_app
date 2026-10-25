import {test,expect,type Page} from '@playwright/test';
async function run(page:Page,command:string){const input=page.getByRole('textbox',{name:'演習コマンド'});await input.fill(command);await input.press('Enter');}
async function openEditor(page:Page,path:string){await page.getByRole('button',{name:`${path}を開く`,exact:true}).click();await page.getByRole('button',{name:'ファイルを編集',exact:true}).click();}

test('GUI creates multiline content, preserves index on edit, and confirms deletion',async({page})=>{
  await page.goto('/game');await page.getByRole('button',{name:'ファイルを作成',exact:true}).click();await page.getByLabel('ファイルのパス',{exact:true}).fill('空 白.txt');await page.getByLabel('ファイルの内容',{exact:true}).fill('one\n"two"\nthree\n');await page.getByRole('button',{name:'作業ツリーに保存',exact:true}).click();await expect(page.locator('pre')).toHaveText('one\n"two"\nthree\n');await page.getByRole('button',{name:'プレビューを閉じる'}).click();
  await run(page,'git add .');await openEditor(page,'空 白.txt');await page.getByLabel('ファイルの内容',{exact:true}).fill('working');await page.getByRole('button',{name:'作業ツリーに保存',exact:true}).click();await page.getByRole('button',{name:'プレビューを閉じる'}).click();await expect(page.getByRole('button',{name:'空 白.txtを開く'})).toContainText('stage済み');await expect(page.getByRole('button',{name:'空 白.txtを開く'})).toContainText('未stage');
  await openEditor(page,'空 白.txt');await page.getByRole('button',{name:'ファイルを削除',exact:true}).click();await page.getByRole('button',{name:'削除をキャンセル',exact:true}).click();await expect(page.getByLabel('ファイルの内容',{exact:true})).toHaveValue('working');await page.getByRole('button',{name:'ファイルを削除',exact:true}).click();await page.getByRole('button',{name:'削除する',exact:true}).click();await expect(page.getByRole('button',{name:'空 白.txtを開く'})).toContainText('削除（未stage）');
});

test('stale edits and duplicate paths are rejected without overwriting newer content',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await openEditor(page,'README.md');await page.getByLabel('ファイルの内容',{exact:true}).fill('old draft');await run(page,'echo "newer" > README.md');await page.getByRole('button',{name:'作業ツリーに保存',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('内容が変わりました');await expect(page.getByLabel('ファイルの内容',{exact:true})).toHaveValue('old draft');await page.getByRole('button',{name:'編集をキャンセル'}).click();
  await page.getByRole('button',{name:'README.mdを開く'}).click();await expect(page.locator('pre')).toHaveText('newer');await page.getByRole('button',{name:'プレビューを閉じる'}).click();await page.getByRole('button',{name:'ファイルを作成',exact:true}).click();await page.getByLabel('ファイルのパス',{exact:true}).fill('README.md');await page.getByRole('button',{name:'作業ツリーに保存',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('同名のファイル');
});

test('cancel and exercise reset discard only the unsaved draft',async({page})=>{
  await page.goto('/game?lesson=level-1-3');await openEditor(page,'README.md');await page.getByLabel('ファイルの内容',{exact:true}).fill('discard');await page.getByLabel('ファイルの内容',{exact:true}).press('Escape');await page.getByRole('button',{name:'README.mdを開く'}).click();await expect(page.locator('pre')).toHaveText('');await page.getByRole('button',{name:'ファイルを編集',exact:true}).click();await page.getByRole('button',{name:'現在の演習を最初からやり直す'}).click();await expect(page.getByLabel('ファイルの内容',{exact:true})).toHaveCount(0);
});
