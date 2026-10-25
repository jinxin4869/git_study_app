import { test, expect } from '@playwright/test';

test('copies output as text without changing Git or history',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copied:string}).copied=text;}}}));
  await page.goto('/game?lesson=level-1-3');
  const input=page.getByRole('textbox',{name:'演習コマンド'});await input.fill('git status');await input.press('Enter');
  const output=page.getByRole('region',{name:'端末出力'});const expected=await output.innerText();
  await page.getByRole('button',{name:'端末出力をコピー',exact:true}).click();
  await expect(page.getByText('押した時点の端末出力をコピーしました。',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toBe(expected);
  await expect(page.locator('aside').getByRole('button',{name:/Level 1-3/})).toContainText('完了済み');
  await input.press('ArrowUp');await expect(input).toHaveValue('git status');
  await input.fill('clear');await input.press('Enter');await expect(page.getByRole('button',{name:'端末出力をコピー',exact:true})).toBeDisabled();
});

test('clipboard denial offers an exact manual snapshot and allows retry',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if(!(window as unknown as {allowCopy:boolean}).allowCopy)throw new DOMException('denied','NotAllowedError');(window as unknown as {copied:string}).copied=text;}}}));
  await page.goto('/game');const output=page.getByRole('region',{name:'端末出力'});const expected=await output.innerText();
  await page.getByRole('button',{name:'端末出力をコピー',exact:true}).click();const fallback=page.getByLabel('手動でコピー',{exact:true});await expect(fallback).toHaveValue(expected);
  await fallback.focus();expect(await fallback.evaluate((element:HTMLTextAreaElement)=>element.selectionEnd-element.selectionStart)).toBe(expected.length);
  await page.evaluate(()=>{(window as unknown as {allowCopy:boolean}).allowCopy=true;});await page.getByRole('button',{name:'端末出力をコピー',exact:true}).click();await expect(fallback).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toBe(expected);
});
