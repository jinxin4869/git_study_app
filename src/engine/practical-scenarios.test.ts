import { describe, expect, it } from 'vitest';
import { practicalScenarios } from './practical-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';
import { scenarios } from './scenarios';
import { headTree, indexTree } from './git-state';

describe('Practical exercises', () => {
  it.each(practicalScenarios)('$id starts incomplete, has a working solution, and can be replayed', scenario => {
    const engine = new GitEngine(scenario.initialState);
    const original = JSON.stringify(scenario.initialState);
    for (let replay = 0; replay < 2; replay++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) {
        expect(engine.execute(command).success, command).toBe(true);
      }
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(original);
    }
  });

  it('does not accept one combined commit as two purpose-specific commits', () => {
    const scenario = practicalScenarios.find(item => item.id === 'daily-split')!;
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git add .');
    engine.execute('git commit -m "Update docs"');
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
  });
});

describe('Existing reset and merge exercises', () => {
  it.each(scenarios.filter(scenario => scenario.id.startsWith('level-')))('$id starts incomplete and has an executable reference solution', scenario => {
    const engine = new GitEngine(scenario.initialState);
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
    for (const command of scenario.solution!) {
      const result = engine.execute(command);
      if (scenario.goal.type !== 'conflict_present') expect(result.success, command).toBe(true);
    }
    expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
  });
  it.each(['level-5-2', 'level-5-4'])('%s requires the requested reset, rather than an existing commit count', id => {
    const scenario = scenarios.find(item => item.id === id)!;
    const engine = new GitEngine(scenario.initialState);
    expect(checkGoal(engine.getState(), scenario, 'status')).toBe(false);
    expect(engine.execute(id === 'level-5-2' ? 'git reset --soft HEAD~1' : 'git reset --hard HEAD~1').success).toBe(true);
    expect(checkGoal(engine.getState(), scenario)).toBe(true);
  });

  it('recognizes fast-forward completion without requiring a merge commit', () => {
    const scenario = scenarios.find(item => item.id === 'level-3-2')!;
    const engine = new GitEngine(scenario.initialState);
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
    engine.execute('git merge feature');
    expect(checkGoal(engine.getState(), scenario)).toBe(true);
  });

  it('retains two parents after resolving a merge conflict', () => {
    const scenario = scenarios.find(item => item.id === 'level-7-1')!;
    const engine = new GitEngine(scenario.initialState);
    expect(engine.execute('git merge feature').success).toBe(false);
    expect(checkGoal(engine.getState(), scenario)).toBe(true);
    expect(engine.execute('git commit -m "Unresolved"').success).toBe(false);
    engine.touch('index.html', 'Combined title');
    expect(engine.execute('git commit -m "Not staged"').success).toBe(false);
    engine.execute('git add index.html');
    expect(engine.execute('git commit -m "Resolve"').success).toBe(true);
    const state = engine.getState();
    expect(state.commits[state.branches.main].parents).toEqual(['c2', 'c3']);
    expect(headTree(state)['index.html']).toBe('Combined title');
    expect(state.pendingMerge).toBeUndefined();
  });

  it('aborts a conflicting merge without losing the original files', () => {
    const scenario = scenarios.find(item => item.id === 'level-7-1')!;
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git merge feature');
    engine.execute('git merge --abort');
    expect(engine.getState().workingDirectory).toEqual(scenario.initialState!.workingDirectory);
    expect(engine.getState().branches.main).toBe('c2');
  });

  it('mixed reset leaves the edit unstaged', () => {
    const scenario = scenarios.find(item => item.id === 'level-5-2')!;
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git reset --mixed HEAD~1');
    expect(indexTree(engine.getState())['error.txt']).toBeUndefined();
    expect(engine.getState().workingDirectory['error.txt']).toBe('oops');
  });

  it('rejects a branch switch that would erase local edits', () => {
    const scenario = scenarios.find(item => item.id === 'level-3-2')!;
    const engine = new GitEngine(scenario.initialState);
    engine.touch('feature.txt', 'local work');
    const before = engine.getState();
    expect(engine.execute('git switch feature').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });

  it('keeps empty tracked files tracked and reports a tracked deletion', () => {
    const engine = new GitEngine();
    engine.execute('touch empty.txt');
    engine.execute('git add empty.txt');
    engine.execute('git commit -m "Empty file"');
    expect(engine.execute('git status').message).toContain('working tree clean');
    engine.execute('rm empty.txt');
    expect(engine.execute('git status').message).toContain('deleted: empty.txt');
    engine.execute('git add .');
    engine.execute('git commit -m "Delete empty file"');
    expect(headTree(engine.getState())['empty.txt']).toBeUndefined();
  });
});
