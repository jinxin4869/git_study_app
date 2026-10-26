import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { githubScenarios } from './github-scenarios';
import { assessGoal } from './goal-checker';
import { parseSession, type SavedSession } from '@/learning/session-store';
import { commandSuggestions } from '@/learning/command-suggestions';
const scenario = githubScenarios.find(item => item.id === 'github-retarget')!;
function resumed(engine: GitEngine) {
  const saved: SavedSession = { version: 1, scenarioId: scenario.id, state: engine.getState(), output: [], history: [], hintLevel: 0, lastAttempt: null };
  return new GitEngine(parseSession(JSON.stringify(saved), new Set([scenario.id])).state);
}
describe('changing the mock PR base', () => {
  it('renews review/CI, survives a checkpoint and merges only into the new base', () => {
    let engine = new GitEngine(scenario.initialState); const before = engine.getState();
    expect(engine.execute('gh pr edit 1 --base release').success).toBe(true);
    const changed = engine.getState();
    expect(changed.github!.pullRequests[1]).toEqual({ ...before.github!.pullRequests[1], base: 'release', review: undefined, checks: undefined });
    expect({ ...changed, github: before.github }).toEqual(before);
    engine = resumed(engine);
    for (const command of ['gh pr merge 1 --merge', 'simulate review approve 1', 'gh pr merge 1 --merge']) {
      const previous = engine.getState(); const result = engine.execute(command);
      if (command.startsWith('gh pr merge')) { expect(result.success).toBe(false); expect(engine.getState()).toEqual(previous); }
    }
    expect(engine.execute('simulate ci pass 1').success).toBe(true);
    expect(engine.execute('gh pr merge 1 --merge').success).toBe(true);
    const after = engine.getState();
    expect(after.mockServers.origin.branches.main).toBe(before.mockServers.origin.branches.main);
    expect(after.mockServers.origin.commits[after.mockServers.origin.branches.release].parents).toEqual(['c3','c2']);
    expect(assessGoal(after, scenario).met).toBe(true);
  });
  it.each(['gh pr edit 1', 'gh pr edit 1 --base missing', 'gh pr edit 1 --base main', 'gh pr edit 1 --base feature/login', 'gh pr edit 1 --base', 'gh pr edit 1 --base release --base main', 'gh pr edit 0 --base release', 'gh pr edit 1 2 --base release', 'gh pr edit 1 --title Wrong', 'gh pr edit 1 --base constructor'])('rejects %s without changing any state', command => {
    const engine = new GitEngine(scenario.initialState); const before = engine.getState();
    expect(engine.execute(command).success).toBe(false); expect(engine.getState()).toEqual(before);
  });
  it.each(['closed', 'merged'] as const)('refuses to edit a %s PR', status => {
    const state = structuredClone(scenario.initialState!); state.github!.pullRequests[1].status = status;
    const engine = new GitEngine(state);
    expect(engine.execute('gh pr edit 1 --base release').success).toBe(false); expect(engine.getState()).toEqual(state);
  });
  it('refuses a duplicate head/base pair and preserves all confirmations', () => {
    const state = structuredClone(scenario.initialState!);
    state.github!.pullRequests[2] = { ...state.github!.pullRequests[1], number: 2, base: 'release' };
    const engine = new GitEngine(state);
    expect(engine.execute('gh pr edit 1 --base release').success).toBe(false); expect(engine.getState()).toEqual(state);
  });
  it('keeps Draft on retarget and offers literal completion for the base flag and branch', () => {
    const engine = new GitEngine(scenario.initialState); engine.execute('gh pr ready 1 --undo');
    expect(engine.execute('gh pr edit --base release').success).toBe(true);
    expect(engine.getState().github!.pullRequests[1].draft).toBe(true);
    expect(commandSuggestions('gh pr ed', engine.getState()).map(item => item.value)).toContain('gh pr edit ');
    expect(commandSuggestions('gh pr edit 1 --b', engine.getState()).map(item => item.value)).toContain('gh pr edit 1 --base ');
    expect(commandSuggestions('gh pr edit 1 --base rel', engine.getState()).map(item => item.value)).toContain('gh pr edit 1 --base release ');
  });
});
