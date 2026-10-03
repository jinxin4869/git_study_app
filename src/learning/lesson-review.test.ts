import { describe, it, expect } from 'vitest';
import { scenarios } from '@/engine/scenarios';
import { GitEngine } from '@/engine/git-simulator';
import { assessGoal } from '@/engine/goal-checker';
import { lessonNotes } from './lesson-notes';
import { learningPath, preparationFor, recommendedNext } from './learning-path';
import { lessonHints } from './hints';

const lesson = (id: string) => scenarios.find(item => item.id === id)!;
describe('reviewed learning material', () => {
  it('has authored notes and a reachable learning order for all 139 existing exercises', () => {
    expect(Object.keys(lessonNotes).sort()).toEqual(scenarios.map(item => item.id).sort());
    expect(learningPath.map(item => item.id).sort()).toEqual(scenarios.map(item => item.id).sort());
    for (const scenario of scenarios) {
      const note = lessonNotes[scenario.id];
      expect(note.concept.length, scenario.id).toBeGreaterThan(15);
      expect(note.verify.length, scenario.id).toBeGreaterThan(15);
      expect(note.caution.length, scenario.id).toBeGreaterThan(15);
      expect(lessonHints(scenario)[0].text).toBe(note.concept);
      expect(lessonHints(scenario)[1].text).toBe(note.verify);
      for (const prerequisite of preparationFor(scenario)) {
        expect(learningPath.indexOf(prerequisite), scenario.id).toBeLessThan(learningPath.indexOf(scenario));
      }
    }
  });
  it('suggests the next unfinished exercise and wraps for review without requiring prior completion', () => {
    expect(recommendedNext('level-1-1', new Set())?.id).toBe('level-1-2');
    expect(recommendedNext('level-1-1', new Set(['level-1-2']))?.id).toBe('level-1-3');
    expect(recommendedNext('workflow-release', new Set())?.id).toBe('level-1-1');
    expect(recommendedNext('level-1-1', new Set(scenarios.map(item => item.id)))).toBeNull();
    expect(recommendedNext('invalid', new Set())).toBeNull();
  });
});

const wrongAttempts: [string, string[]][] = [
  ['level-1-5', ['git restore --staged README.md', 'touch other.txt', 'git add other.txt', 'git commit -m "Unrelated"']],
  ['level-1-9', ['touch other.txt', 'git add other.txt', 'git commit -m "Unrelated"']],
  ['level-2-3', ['git switch main', 'touch feature.txt']],
  ['level-2-4', ['touch other.txt', 'git add other.txt', 'git commit -m "Unrelated"']],
  ['level-2-7', ['git switch feature', 'touch main.txt']],
  ['level-2-8', ['touch other.txt', 'git add other.txt', 'git commit -m "Unrelated"']],
  ['level-3-3', ['touch other.txt', 'git add other.txt', 'git commit -m "Unrelated"']],
  ['level-6-2', ['git checkout c2']],
  ['daily-split', ['git add .', 'git commit -m "Update app"', 'touch unrelated', 'git add unrelated', 'git commit -m "Update docs"']],
  ['github-create', ['gh pr create --title "Add login" --body "" --base main']],
  ['github-ci-failure', ['simulate ci fail 1']],
  ['github-ci-success', ['simulate ci pass 1']],
  ['github-review-feedback', ['simulate review request-changes 1 --body "テストを追加してください"']],
];
describe('reproduced gaps between lesson objectives and grading', () => {
  it.each(wrongAttempts)('%s rejects a successful operation with the wrong target or an incomplete learning task', (id, commands) => {
    const scenario = lesson(id);
    const engine = new GitEngine(scenario.initialState);
    let result;
    for (const command of commands) { result = engine.execute(command); expect(result.success, command).toBe(true); }
    const assessment = assessGoal(engine.getState(), scenario, commands.at(-1), result);
    expect(assessment.met).toBe(false);
    expect(assessment.conditions.some(item => !item.met)).toBe(true);
  });
  it('rejects unknown grading fields instead of silently treating them as satisfied', () => {
    const scenario = { ...lesson('daily-select'), goal: { type: 'state_matches' as const, params: { typoWorking: {} } } };
    expect(assessGoal(new GitEngine(scenario.initialState).getState(), scenario).met).toBe(false);
  });
  it('describes the PR integration tree as the server base rather than local HEAD', () => {
    const scenario = lesson('github-merge');
    expect(assessGoal(new GitEngine(scenario.initialState).getState(), scenario).conditions.find(item => item.id === 'tree')?.label).toContain('模擬PRの統合先');
  });
  it.each([
    ['level-1-2', ['echo "Hello" > README.md']],
    ['level-1-4', ['git add .']],
    ['level-1-10', ['echo "export const app = true" > app.ts', 'git add .', 'git commit -m "Record application"']],
    ['level-2-1', ['git checkout -b feature']],
    ['level-2-2', ['git checkout feature']],
    ['daily-delete', ['rm README.md', 'git add README.md', 'git commit -m "Remove README"']],
    ['github-create', ['gh pr create --title "Add login" --body "別の説明文" --base main']],
  ] as [string, string[]][])('%s accepts a validated alternative with the required state', (id, commands) => {
    const scenario = lesson(id);
    const engine = new GitEngine(scenario.initialState);
    let result;
    for (const command of commands) { result = engine.execute(command); expect(result.success, command).toBe(true); }
    expect(assessGoal(engine.getState(), scenario, commands.at(-1), result).met).toBe(true);
  });
});
