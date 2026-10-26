import { expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { historyScenarios } from './history-scenarios';
import { headTree } from './git-state';
it('reflog rescues the committed version but does not resurrect an unrecorded edit', () => {
  const scenario = historyScenarios.find(item => item.id === 'history-recover-reset')!;
  const engine = new GitEngine(scenario.initialState);
  const recorded = headTree(engine.getState())['app.ts'];
  expect(engine.execute('echo "Unrecorded edit" > app.ts').success).toBe(true);
  for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
  expect(engine.getState().workingDirectory['app.ts']).toBe(recorded);
  expect(JSON.stringify(engine.getState().commits)).not.toContain('Unrecorded edit');
});
