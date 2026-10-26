import { test, expect } from '@playwright/test';
test('recovery comparison and questions explain limits without altering the exercise', async ({ page }) => {
  await page.goto('/game?lesson=level-1-1');
  await page.getByText('操作リファレンス・理解度チェック', { exact: true }).click();
  const guide = page.getByRole('region', { name: '復旧できる内容・できない内容' });
  await guide.getByText('未追跡ファイルをcleanで削除する前', { exact: true }).click();
  await expect(guide).toContainText('削除もバックアップもしない');
  const question = page.getByRole('group', { name: '1. git clean -n -dで必要な未追跡ファイルが候補に出ました。次にどうする？', exact: true });
  await question.getByLabel('dry-runした時点でバックアップ済み').check();
  await expect(question.getByRole('status')).toContainText('もう一度');
  await question.getByLabel('必要な内容を別に保管してから削除の要否を判断する').check();
  await expect(question.getByRole('status')).toContainText('正解。');
  await expect(page.getByText('演習を達成しました！', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '確認問題をやり直す' }).click();
  await expect(question.getByRole('status')).toHaveCount(0);
  await guide.getByRole('link', { name: '記録済みコミットの救出を練習', exact: true }).click();
  await expect(page).toHaveURL(/lesson=history-recover-reset/);
});
