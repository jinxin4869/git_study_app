import { test, expect } from '@playwright/test';
import { capstoneScenarios } from '../src/engine/capstone-scenarios';
for (const scenario of capstoneScenarios) {
  test(`${scenario.id} keeps hints hidden until the objective is complete`, async ({ page }) => {
    await page.goto(`/game?lesson=${scenario.id}`);
    await expect(page.getByText('この総合課題ではヒントを表示しません。', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /^ヒント / })).toHaveCount(0);
    await expect(page.getByText('総合課題の解答例', { exact: true })).toHaveCount(0);
    const input = page.getByRole('textbox', { name: '演習コマンド' });
    for (const command of scenario.solution!) { await input.fill(command); await input.press('Enter'); }
    await expect(page.getByText('演習を達成しました！', { exact: true })).toBeVisible();
    await page.getByText('総合課題の解答例', { exact: true }).click();
    await expect(page.getByText(scenario.solution!.join('\n'), { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^ヒント / })).toHaveCount(0);
    await expect(page.getByText('総合課題の解答例', { exact: true })).toHaveCount(0);
  });
}
