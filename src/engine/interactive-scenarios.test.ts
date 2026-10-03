import { describe, expect, it } from 'vitest';
import { interactiveScenarios } from './interactive-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';

describe('Interactive history editing', () => {
  it.each(interactiveScenarios)('$id changes history as requested without changing the source template', scenario => {
    const engine = new GitEngine(scenario.initialState);
    const initial = JSON.stringify(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(initial);
    }
  });
  it('rejects duplicate commits and squash as the first kept commit', () => {
    const engine = new GitEngine(interactiveScenarios[0].initialState);
    engine.execute('git rebase -i HEAD~2');
    engine.setRebaseTodo('pick c2\npick c2');
    expect(engine.execute('git rebase --continue').success).toBe(false);
    engine.setRebaseTodo('squash c2\npick c3');
    expect(engine.execute('git rebase --continue').success).toBe(false);
    expect(engine.getState().operation?.awaiting).toBe('todo');
  });
  it('aborts the todo editor and restores the original branch and files', () => {
    const scenario = interactiveScenarios[0];
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git rebase -i HEAD~2');
    engine.setRebaseTodo('drop c2\ndrop c3');
    expect(engine.execute('git rebase --abort').success).toBe(true);
    expect(engine.getState().branches.main).toBe('c3');
    expect(engine.getState().workingDirectory).toEqual(scenario.initialState!.workingDirectory);
  });
});
