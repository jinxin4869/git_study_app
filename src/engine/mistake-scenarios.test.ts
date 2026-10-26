import { describe, expect, it } from 'vitest';
import { mistakeScenarios } from './mistake-scenarios';
import { GitEngine } from './git-simulator';
import { assessGoal } from './goal-checker';

const lesson = (id: string) => mistakeScenarios.find(item => item.id === id)!;
describe('diagnosing mistakes', () => {
  it.each(mistakeScenarios)('$id is incomplete until its recovery finishes', scenario => {
    const engine = new GitEngine(scenario.initialState);
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
    for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
    expect(assessGoal(engine.getState(), scenario).met).toBe(true);
  });
  it('committing the old index does not accept a newer working edit', () => {
    const scenario = lesson('mistake-stale-index'); const engine = new GitEngine(scenario.initialState);
    expect(engine.execute('git commit -m "Old draft"').success).toBe(true);
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
    expect(engine.getState().workingDirectory['app.ts']).toBe('Fixed');
  });
  it('resetting main before protecting the commit does not complete recovery', () => {
    const scenario = lesson('mistake-wrong-branch'); const engine = new GitEngine(scenario.initialState);
    engine.execute('git reset --hard c1'); engine.execute('git switch feature');
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
  });
  it('old approval and CI cannot merge, and refreshing only one is insufficient', () => {
    const scenario = lesson('mistake-stale-approval'); const engine = new GitEngine(scenario.initialState);
    for (const command of ['gh pr merge 1 --merge', 'simulate review approve 1', 'gh pr merge 1 --merge']) {
      const before = engine.getState(); const result = engine.execute(command);
      if (command.startsWith('gh pr merge')) { expect(result.success).toBe(false); expect(engine.getState()).toEqual(before); }
      expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
    }
  });
});
