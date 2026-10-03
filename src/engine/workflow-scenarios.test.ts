import { describe, expect, it } from 'vitest';
import { workflowScenarios } from './workflow-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';

describe('Complete team workflows', () => {
  it.each(workflowScenarios)('$id can be executed end to end and repeated independently', scenario => {
    const initial = JSON.stringify(scenario.initialState);
    const engine = new GitEngine(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      const failures = [...(scenario.expectedFailures ?? [])];
      for (const command of scenario.solution!) {
        const index = failures.indexOf(command);
        expect(engine.execute(command).success, command).toBe(index < 0);
        if (index >= 0) failures.splice(index, 1);
      }
      expect(failures).toEqual([]);
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(initial);
    }
  });
  it('reverting shared work preserves the original bug commit and the later documentation', () => {
    const scenario = workflowScenarios.find(s => s.id === 'workflow-revert')!;
    const engine = new GitEngine(scenario.initialState);
    scenario.solution!.forEach(command => engine.execute(command));
    expect(engine.getState().mockServers.origin.commits.c2.tree['app.ts']).toBe('Broken');
    expect(engine.getState().workingDirectory['README.md']).toBe('Useful docs');
  });
});
