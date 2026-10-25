import {test,expect} from '@playwright/test';

test('Tab completes a unique command but never executes or traps complete input',async({page})=>{
  await page.goto('/game?lesson=level-1-3');const input=page.getByRole('textbox',{name:'演習コマンド'});
  await input.fill('git stat');await input.press('Tab');await expect(input).toHaveValue('git status ');await expect(input).toBeFocused();await expect(page.getByText('演習を達成しました！',{exact:true})).toHaveCount(0);
  await input.press('Enter');await expect(page.getByText('演習を達成しました！',{exact:true})).toBeVisible();
  await input.fill('git status');await input.press('Tab');await expect(input).not.toBeFocused();await expect(input).toHaveValue('git status');
});

test('history search selects without executing and Enter in search cannot submit a command',async({page})=>{
  await page.goto('/game');const input=page.getByRole('textbox',{name:'演習コマンド'});
  await input.fill('touch notes.txt');await input.press('Enter');await input.fill('git status');await input.press('Enter');await input.fill('rm notes.txt');
  await page.getByText('入力補完・履歴検索',{exact:true}).click();const query=page.getByLabel('履歴の検索',{exact:true});await query.fill('touch');await query.press('Enter');
  await expect(page.getByRole('button',{name:'notes.txtを開く'})).toBeVisible();await expect(input).toHaveValue('rm notes.txt');
  await page.getByRole('button',{name:'履歴: touch notes.txt',exact:true}).click();await expect(input).toHaveValue('touch notes.txt');await expect(input).toBeFocused();await expect(query).not.toBeVisible();
  await page.getByText('入力補完・履歴検索',{exact:true}).click();await query.fill('missing');await expect(page.getByText('一致する履歴がありません。',{exact:true})).toBeVisible();await query.dispatchEvent('keydown',{key:'Escape',isComposing:true,keyCode:229});await expect(query).toBeVisible();await query.press('Escape');await expect(query).not.toBeVisible();
});

test('file completion quotes Japanese spaces and exercise reset clears history search',async({page})=>{
  await page.goto('/game');const input=page.getByRole('textbox',{name:'演習コマンド'});
  for(const command of ['echo "keep" > "空 白.txt"','git add 空']){await input.fill(command);if(command.startsWith('echo'))await input.press('Enter');else await input.press('Tab');}
  await expect(input).toHaveValue('git add "空 白.txt" ');await input.press('Enter');await expect(page.getByRole('button',{name:'空 白.txtを開く'})).toContainText('stage済み');
  await page.getByRole('button',{name:'現在の演習を最初からやり直す'}).click();await page.getByText('入力補完・履歴検索',{exact:true}).click();await expect(page.getByText('一致する履歴がありません。',{exact:true})).toBeVisible();
});
