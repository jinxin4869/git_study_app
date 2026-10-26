import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { githubScenarios } from './github-scenarios';
import { parseSession, type SavedSession } from '@/learning/session-store';
import { commandHelp } from './command-input';
import { commandSuggestions } from '@/learning/command-suggestions';

const fixture = (open: boolean) => new GitEngine(githubScenarios.find(item => item.id === (open ? 'github-merge' : 'github-create'))!.initialState);
const capture = (engine: GitEngine): SavedSession => ({ version: 1, scenarioId: null, state: engine.getState(), output: [], history: [], hintLevel: 0, lastAttempt: null });

describe('mock Draft pull requests', () => {
  it('creates a Draft, retains checks when ready and blocks merging until ready', () => {
    const engine = fixture(false);
    expect(engine.execute('gh pr create --draft --title "Draft feature" --body "Work in progress"').success).toBe(true);
    expect(engine.getState().github!.pullRequests[1].draft).toBe(true);
    expect(engine.execute('gh pr view 1').message).toContain('Draft・下書き');
    for (const command of ['simulate review approve 1', 'simulate ci pass 1']) expect(engine.execute(command).success).toBe(true);
    const before = engine.getState();
    expect(engine.execute('gh pr merge 1 --merge').message).toContain('Draft PR');
    expect(engine.getState()).toEqual(before);
    expect(engine.execute('gh pr ready 1').success).toBe(true);
    const ready = engine.getState();
    expect(ready.github!.pullRequests[1].draft).toBe(false);
    expect(ready.github!.pullRequests[1].review).toEqual(before.github!.pullRequests[1].review);
    expect(ready.github!.pullRequests[1].checks).toEqual(before.github!.pullRequests[1].checks);
    expect(ready.mockServers).toEqual(before.mockServers);
    expect(engine.execute('gh pr merge 1 --merge').success).toBe(true);
    const merged = engine.getState();
    expect(engine.execute('gh pr ready 1 --undo').success).toBe(false);
    expect(engine.getState()).toEqual(merged);
  });

  it('converts an existing PR to Draft and restores it through a checkpoint', () => {
    let engine = fixture(true);
    expect(engine.execute('gh pr ready --undo').success).toBe(true);
    const session = capture(engine);
    engine = new GitEngine(parseSession(JSON.stringify(session), new Set()).state);
    expect(engine.getState().github!.pullRequests[1].draft).toBe(true);
    expect(engine.execute('gh pr ready').success).toBe(true);
    // Ready does not bypass existing review/CI protection.
    const before = engine.getState();
    expect(engine.execute('gh pr merge --merge').success).toBe(false);
    expect(engine.getState()).toEqual(before);
    const invalid = JSON.parse(JSON.stringify(session));
    invalid.state.github.pullRequests[1].draft = 'yes';
    expect(() => parseSession(JSON.stringify(invalid), new Set())).toThrow();
  });

  it('rejects invalid transitions and syntax without changing any state', () => {
    const engine = fixture(true);
    for (const command of ['gh pr ready', 'gh pr ready 1 2', 'gh pr ready 1.0', 'gh pr ready 999', 'gh pr ready --draft', 'gh pr create --undo --title "New" --body "Body"']) {
      const before = engine.getState();
      expect(engine.execute(command).success, command).toBe(false);
      expect(engine.getState()).toEqual(before);
    }
    expect(engine.execute('gh pr ready --undo').success).toBe(true);
    const draft = engine.getState();
    expect(engine.execute('gh pr ready --undo').success).toBe(false);
    expect(engine.getState()).toEqual(draft);
    expect(engine.execute('gh pr close').success).toBe(true);
    for (const command of ['gh pr ready', 'gh pr ready --undo']) {
      const before = engine.getState();
      expect(engine.execute(command).success).toBe(false);
      expect(engine.getState()).toEqual(before);
    }
    expect(commandHelp()).toContain('ready [--undo]');
    expect(commandSuggestions('gh pr re', engine.getState()).map(item => item.value)).toContain('gh pr ready ');
    expect(commandSuggestions('gh pr ready --u', engine.getState()).map(item => item.value)).toContain('gh pr ready --undo ');
    expect(commandSuggestions('gh pr create --d', engine.getState()).map(item => item.value)).toContain('gh pr create --draft ');
  });
});
