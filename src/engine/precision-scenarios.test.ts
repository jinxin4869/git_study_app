import { describe, expect, it } from 'vitest';
import { precisionScenarios } from './precision-scenarios';
import { GitEngine } from './git-simulator';
import { checkGoal } from './goal-checker';
import { isIgnored } from './gitignore';

describe('Selective changes and investigation', () => {
  it.each(precisionScenarios)('$id can be solved and replayed independently', scenario => {
    const initial = JSON.stringify(scenario.initialState);
    const engine = new GitEngine(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(!scenario.expectedFailures?.includes(command));
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(initial);
    }
  });
  it('retains provenance when unchanged lines move down', () => {
    const engine = new GitEngine(precisionScenarios.find(s => s.id === 'precision-blame')!.initialState);
    const lines = engine.execute('git blame app.ts').message.split('\n');
    expect(lines.map(line => line.split(' ')[0])).toEqual(['c2', 'c3', 'c1']);
  });
  it('ignored files are excluded from add but tracked files remain tracked', () => {
    const engine = new GitEngine(precisionScenarios.find(s => s.id === 'precision-ignore')!.initialState);
    engine.execute('echo "build/" > .gitignore');
    expect(isIgnored(engine.getState(), 'build/output.txt')).toBe(true);
    expect(engine.execute('git add build/output.txt').success).toBe(false);
    engine.execute('git add .');
    expect(engine.getState().index['build/output.txt']).toBeUndefined();
    const tracked = new GitEngine(precisionScenarios.find(s => s.id === 'precision-untrack')!.initialState);
    tracked.execute('echo "*.log" > .gitignore');
    expect(isIgnored(tracked.getState(), 'debug.log')).toBe(false);
  });
  it('does not accept committing the entire file for partial staging', () => {
    const scenario = precisionScenarios[0];
    const engine = new GitEngine(scenario.initialState);
    engine.execute('git add app.ts');
    engine.execute('git commit -m "Enable feature"');
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
  });
  it('filters log messages and compares the named commit snapshots', () => {
    const engine = new GitEngine(precisionScenarios.find(s => s.id === 'precision-blame')!.initialState);
    const log = engine.execute('git log --grep Feature').message;
    expect(log).toContain('commit c3');
    expect(log).not.toContain('commit c1');
    const diff = engine.execute('git diff c1 c3 -- app.ts').message;
    expect(diff).toContain('-old');
    expect(diff).toContain('+updated');
  });
});
