import { describe, expect, it } from 'vitest';
import { advancedScenarios } from './advanced-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';

describe('Advanced repository configurations', () => {
  it.each(advancedScenarios)('$id can be solved and reset independently', scenario => {
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
  it('sparse checkout does not stage excluded files as deletions', () => {
    const engine = new GitEngine(advancedScenarios.find(s => s.id === 'advanced-sparse')!.initialState);
    engine.execute('git sparse-checkout set src');
    expect(engine.execute('git status').message).toContain('working tree clean');
    expect(engine.execute('git diff').message).toBe('');
    engine.execute('echo "updated" > src/app.ts');
    engine.execute('git add .');
    engine.execute('git commit -m "Update included files"');
    const state = engine.getState();
    expect(state.commits[state.branches.main].tree['tests/spec.ts']).toBe('test');
  });
  it('refuses to delete a branch checked out in another worktree', () => {
    const engine = new GitEngine(advancedScenarios.find(s => s.id === 'advanced-worktree-remove')!.initialState);
    expect(engine.execute('git branch -D hotfix').success).toBe(false);
    expect(engine.execute('git switch hotfix').success).toBe(false);
  });
  it('refuses to remove a worktree with local edits', () => {
    const state = new GitEngine(advancedScenarios.find(s => s.id === 'advanced-worktree-remove')!.initialState).getState();
    state.worktrees!['/workspace/hotfix'].workingDirectory['app.ts'] = 'draft';
    const engine = new GitEngine(state);
    expect(engine.execute('git worktree remove ../hotfix').success).toBe(false);
    expect(engine.getState()).toEqual(state);
  });
});
