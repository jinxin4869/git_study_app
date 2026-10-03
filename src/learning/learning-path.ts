import { scenarios } from '@/engine/scenarios';
import type { Scenario } from '@/types/git';

const legacyCourses = ['基本操作', 'ブランチ', 'マージ', '作業の退避', '取り消し', '過去の調査', 'コンフリクト'];
export const scenarioCategory = (scenario: Scenario) => scenario.category ?? legacyCourses[Number(scenario.id.match(/^level-(\d+)/)?.[1]) - 1] ?? 'その他';
export const learningCourses = ['基本操作', 'ブランチ', 'マージ', '日常操作・取り消し', '作業の退避', '取り消し', '過去の調査', 'コンフリクト', 'リモート・チーム開発', '履歴・調査・復旧', '競合の継続・中断', '履歴整理・対話的rebase', '不具合の調査', '並行作業・特殊構成', 'GitHub・PR・レビュー・CI', '実務の総合演習'];
export const learningPath = learningCourses.flatMap(course => scenarios.filter(item => scenarioCategory(item) === course));
const coursePrerequisites: Record<string, string[]> = {
  'ブランチ': ['level-1-10'], 'マージ': ['level-2-9'], '日常操作・取り消し': ['level-1-9'],
  '作業の退避': ['daily-status'], '取り消し': ['daily-restore', 'daily-amend-file'], '過去の調査': ['level-1-6', 'level-2-2'],
  'コンフリクト': ['level-3-5'], 'リモート・チーム開発': ['level-3-5'], '履歴・調査・復旧': ['level-6-3'],
  '競合の継続・中断': ['history-rebase', 'history-pick', 'history-revert', 'level-7-4'],
  '履歴整理・対話的rebase': ['operation-rebase-continue', 'daily-split'],
  '不具合の調査': ['history-show-file'], '並行作業・特殊構成': ['daily-status', 'daily-switch'],
  'GitHub・PR・レビュー・CI': ['remote-first-push'], '実務の総合演習': ['github-merge', 'operation-rebase-continue', 'stash-pop'],
};

/** Suggested preparation only: every exercise still starts from its own independent state. */
export function preparationFor(scenario: Scenario) {
  const course = scenarioCategory(scenario);
  const lessons = learningPath.filter(item => scenarioCategory(item) === course);
  const index = lessons.findIndex(item => item.id === scenario.id);
  const ids = index > 0 ? [lessons[index - 1].id] : coursePrerequisites[course] ?? [];
  return ids.map(id => scenarios.find(item => item.id === id)!).filter(Boolean);
}

export function recommendedNext(currentId: string, completed: Set<string>) {
  const index = learningPath.findIndex(item => item.id === currentId);
  if (index < 0) return null;
  const remaining = [...learningPath.slice(index + 1), ...learningPath.slice(0, index)];
  return remaining.find(item => !completed.has(item.id)) ?? null;
}
