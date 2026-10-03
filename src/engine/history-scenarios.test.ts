import { describe, expect, it } from 'vitest';
import { historyScenarios } from './history-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';

describe('History, investigation and recovery', () => {
  it.each(historyScenarios)('$id has an executable solution and an independent initial state', scenario => {
    const original = JSON.stringify(scenario.initialState);
    const engine = new GitEngine(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(original);
    }
  });

  it('refuses ordinary deletion of an unmerged branch', () => {
    const engine = new GitEngine(historyScenarios[0].initialState);
    const original = engine.getState();
    expect(engine.execute('git branch -d feature').success).toBe(false);
    expect(engine.getState()).toEqual(original);
  });

  it('does not accept a lightweight tag for the annotated-tag exercise', () => {
    const scenario = historyScenarios.find(s => s.id === 'history-annotated-tag')!;
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git tag v1.1.0');
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
  });

  it('refuses rebase with uncommitted edits without losing files', () => {
    const engine = new GitEngine(historyScenarios.find(s => s.id === 'history-rebase')!.initialState);
    engine.touch('app.ts', 'Local edit');
    const original = engine.getState();
    expect(engine.execute('git rebase main').success).toBe(false);
    expect(engine.getState()).toEqual(original);
  });

  it('keeps unrelated untracked files on hard reset', () => {
    const engine = new GitEngine(historyScenarios.find(s => s.id === 'history-recover-reset')!.initialState);
    engine.touch('notes.txt', 'Private notes');
    engine.execute('git reset --hard HEAD~1');
    expect(engine.getState().workingDirectory['notes.txt']).toBe('Private notes');
  });
});
