import { test, expect } from '@playwright/test';
import { mistakeScenarios } from '../src/engine/mistake-scenarios';
for (const scenario of mistakeScenarios) {
  test(`${scenario.id} is selectable and completes only after recovery`, async ({ page }) => {
    await page.goto(`/game?lesson=${scenario.id}`);
    const done = page.getByText('演習を達成しました！', { exact: true });
    await expect(done).toHaveCount(0);
    const input = page.getByRole('textbox', { name: '演習コマンド' });
    if (scenario.id === 'mistake-stale-approval') {
      await input.fill('gh pr merge 1 --merge'); await input.press('Enter');
      await expect(done).toHaveCount(0);
    }
    for (const command of scenario.solution!) { await input.fill(command); await input.press('Enter'); }
    await expect(done).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(scenario.title) }).first()).toContainText('完了');
  });
}
