import { describe, expect, it } from 'vitest';
import { capstoneScenarios } from './capstone-scenarios';
import { GitEngine } from './git-simulator';
import { assessGoal } from './goal-checker';

describe('independent capstone objectives', () => {
  it.each(capstoneScenarios)('$id grades final state, not a prescribed command sequence', scenario => {
    const engine = new GitEngine(scenario.initialState);
    for (const command of scenario.solution!) {
      expect(assessGoal(engine.getState(), scenario).met).toBe(false);
      expect(engine.execute(command).success, command).toBe(true);
    }
    expect(assessGoal(engine.getState(), scenario).met).toBe(true);
  });
  it('rejects accidentally publishing private drafts even when push succeeds', () => {
    const scenario = capstoneScenarios[0]; const engine = new GitEngine(scenario.initialState);
    for (const command of ['git switch -c delivery', 'git add .', 'git commit -m "Everything"', 'git push -u origin delivery']) expect(engine.execute(command).success).toBe(true);
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
  });
  it('accepts another commit message without requiring status or the reference commands', () => {
    const scenario = capstoneScenarios[0]; const engine = new GitEngine(scenario.initialState);
    for (const command of ['git checkout -b delivery', 'git add app.ts', 'git commit -m "Ship only tested change"', 'git push -u origin delivery']) expect(engine.execute(command).success, command).toBe(true);
    expect(assessGoal(engine.getState(), scenario).met).toBe(true);
  });
  it('rejects restoring content by erasing shared history and losing the memo', () => {
    const scenario = capstoneScenarios[1]; const engine = new GitEngine(scenario.initialState);
    engine.execute('git reset --hard c1');
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
  });
});
