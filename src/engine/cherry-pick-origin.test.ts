import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { headId, headTree } from './git-state';
import { commandHelp, completionFlags } from './command-input';
import { parseSession, type SavedSession } from '@/learning/session-store';

function fixture(conflict = false) {
  const engine = new GitEngine();
  for (const command of [
    'echo "base" > app.ts', 'git add .', 'git commit -m "Root"',
    'git switch -c feature', `echo "feature" > ${conflict ? 'app.ts' : 'feature.ts'}`, 'git add .', 'git commit -m "Feature" -m "Details"',
    'echo "docs" > notes.txt', 'git add .', 'git commit -m "Notes"',
    'git switch main', 'echo "main" > app.ts', 'git add .', 'git commit -m "Main"',
  ]) expect(engine.execute(command).success, command).toBe(true);
  return engine;
}
const message = (engine: GitEngine) => { const state = engine.getState(); return state.commits[headId(state)].message; };
const capture = (engine: GitEngine): SavedSession => ({ version: 1, scenarioId: null, state: engine.getState(), output: [], history: [], hintLevel: 0, lastAttempt: null });

describe('cherry-pick origin attribution', () => {
  it.each([false, true])('records each resolved source only with -x: %s', withOrigin => {
    const engine = fixture();
    const before = engine.getState();
    expect(engine.execute(`git cherry-pick ${withOrigin ? '-x' : ''} feature~1 feature`).success).toBe(true);
    const state = engine.getState();
    const tip = state.commits[headId(state)];
    const first = state.commits[tip.parents[0]];
    const source = before.commits[before.branches.feature];
    const origin = (id: string) => withOrigin ? `\n\n(cherry picked from commit ${id})` : '';
    expect(first.message).toBe('Feature\n\nDetails' + origin(source.parents[0]));
    expect(tip.message).toBe('Notes' + origin(source.id));
    expect(headTree(state)).toEqual({ 'app.ts': 'main', 'feature.ts': 'feature', 'notes.txt': 'docs' });
    for (const [id, commit] of Object.entries(before.commits)) expect(state.commits[id]).toEqual(commit);
    expect(state.operation).toBeUndefined();
  });

  it('retains origin for the paused and later sources after checkpoint restoration', () => {
    let engine = fixture(true);
    const source = engine.getState().commits[engine.getState().branches.feature];
    const result = engine.execute('git cherry-pick -x feature~1 feature');
    expect(result.success).toBe(false);
    expect(engine.getState().unmergedPaths).toContain('app.ts');
    const session = capture(engine);
    engine = new GitEngine(parseSession(JSON.stringify(session), new Set()).state);
    expect(engine.getState().operation?.recordOrigin).toBe(true);
    for (const command of ['echo "Resolved" > app.ts', 'git add app.ts', 'git cherry-pick --continue']) expect(engine.execute(command).success, command).toBe(true);
    const state = engine.getState();
    const tip = state.commits[headId(state)];
    expect(tip.message).toBe(`Notes\n\n(cherry picked from commit ${source.id})`);
    expect(state.commits[tip.parents[0]].message).toBe(`Feature\n\nDetails\n\n(cherry picked from commit ${source.parents[0]})`);
    expect(headTree(state)['app.ts']).toBe('Resolved');

    const invalid = JSON.parse(JSON.stringify(session));
    invalid.state.operation.recordOrigin = 'yes';
    expect(() => parseSession(JSON.stringify(invalid), new Set())).toThrow();
    invalid.state.operation.recordOrigin = true;
    invalid.state.operation.kind = 'rebase';
    expect(() => parseSession(JSON.stringify(invalid), new Set())).toThrow();
  });

  it('aborts without editing the source and rejects misplaced -x controls', () => {
    const engine = fixture(true);
    const before = engine.getState();
    expect(engine.execute('git cherry-pick -x feature~1').success).toBe(false);
    for (const command of ['git cherry-pick --continue -x', 'git cherry-pick -x --abort']) {
      const paused = engine.getState();
      expect(engine.execute(command).success, command).toBe(false);
      expect(engine.getState()).toEqual(paused);
    }
    expect(engine.execute('git cherry-pick --abort').success).toBe(true);
    expect(engine.getState().HEAD).toEqual(before.HEAD);
    expect(headTree(engine.getState())).toEqual(headTree(before));
    for (const command of ['git cherry-pick -x', 'git cherry-pick -x missing', 'git rebase -x main', 'git revert -x HEAD']) {
      const state = engine.getState();
      expect(engine.execute(command).success, command).toBe(false);
      expect(engine.getState()).toEqual(state);
    }
    expect(commandHelp('cherry-pick')).toContain('[-x] <commit...>');
    expect(completionFlags('cherry-pick')).toContain('-x');
    expect(message(engine)).toBe('Main');
  });

  it('skip keeps attribution for the next source without creating the skipped commit', () => {
    const engine = fixture(true);
    const source = engine.getState().commits[engine.getState().branches.feature];
    const before = Object.keys(engine.getState().commits).length;
    expect(engine.execute('git cherry-pick -x feature~1 feature').success).toBe(false);
    expect(engine.execute('git cherry-pick --skip').success).toBe(true);
    expect(message(engine)).toBe(`Notes\n\n(cherry picked from commit ${source.id})`);
    expect(Object.keys(engine.getState().commits)).toHaveLength(before + 1);
    expect(headTree(engine.getState())).toEqual({ 'app.ts': 'main', 'notes.txt': 'docs' });
  });
});
