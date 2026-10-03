import { describe, expect, it } from 'vitest';
import { operationScenarios } from './operation-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';

describe('Pausing, continuing, aborting and stashing', () => {
  it.each(operationScenarios)('$id reaches its goal and can be reset', scenario => {
    const engine = new GitEngine(scenario.initialState);
    const initial = JSON.stringify(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(!scenario.expectedFailures?.includes(command));
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(initial);
    }
  });

  it('does not continue an unresolved or unstaged conflict', () => {
    const engine = new GitEngine(operationScenarios[0].initialState);
    engine.execute('git rebase main');
    expect(engine.execute('git rebase --continue').success).toBe(false);
    engine.touch('app.ts', 'Resolved');
    expect(engine.execute('git rebase --continue').success).toBe(false);
    engine.execute('git add app.ts');
    expect(engine.execute('git rebase --continue').success).toBe(true);
  });

  it('keeps stash and local edits when application is unsafe', () => {
    const engine = new GitEngine(operationScenarios.find(s => s.id === 'stash-apply')!.initialState);
    engine.touch('app.ts', 'Existing edits');
    const initial = engine.getState();
    expect(engine.execute('git stash pop').success).toBe(false);
    expect(engine.getState()).toEqual(initial);
  });

  it('preserves unrelated untracked files while replaying commits', () => {
    const engine = new GitEngine(operationScenarios[0].initialState);
    engine.touch('notes.txt', 'memo');
    engine.execute('git rebase main');
    engine.touch('app.ts', 'Resolved');
    engine.execute('git add app.ts');
    expect(engine.execute('git rebase --continue').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
  });
});
