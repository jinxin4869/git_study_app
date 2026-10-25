import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitEngine } from './git-simulator';
import { githubScenarios } from './github-scenarios';
import { headId } from './git-state';

afterEach(() => vi.restoreAllMocks());
function run(engine: GitEngine, commands: string[]) {
  for (const command of commands) expect(engine.execute(command).success, command).toBe(true);
}
describe('simulation IDs never overwrite existing objects', () => {
  it.each([0, 0.5])('preserves commit and amend history with repeated randomness %s', value => {
    vi.spyOn(Math, 'random').mockReturnValue(value);
    const engine = new GitEngine();
    run(engine, ['echo "base" > app.ts', 'git add .', 'git commit -m "Root"']);
    const root = engine.getState();
    const rootId = headId(root);
    run(engine, ['echo "next" > app.ts', 'git add .', 'git commit -m "Next"', 'git commit --amend -m "Amended"']);
    const state = engine.getState();
    expect(Object.keys(state.commits)).toHaveLength(3);
    expect(rootId).not.toBe('');
    expect(state.commits[rootId]).toEqual(root.commits[rootId]);
    const tip = state.commits[headId(state)];
    expect(tip.parents).toEqual([rootId]);
    expect(tip.id).not.toBe(rootId);
    expect(state.commits[state.reflog![1].id].message).toBe('Next');
  });

  it('allocates a distinct automatic merge commit when the generator repeats', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new GitEngine();
    run(engine, ['echo "base" > app.ts', 'git add .', 'git commit -m "Root"', 'git switch -c feature', 'echo "feature" > feature.ts', 'git add .', 'git commit -m "Feature"', 'git switch main', 'echo "docs" > README.md', 'git add .', 'git commit -m "Docs"']);
    const before = engine.getState();
    run(engine, ['git merge feature']);
    const state = engine.getState();
    const merged = state.commits[headId(state)];
    expect(merged.parents).toEqual([before.branches.main, before.branches.feature]);
    expect(Object.keys(state.commits)).toHaveLength(4);
    for (const [id, commit] of Object.entries(before.commits)) expect(state.commits[id]).toEqual(commit);
  });

  it('reserves unfetched remote IDs when committing locally', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = new GitEngine();
    run(engine, ['echo "base" > app.ts', 'git add .', 'git commit -m "Root"']);
    const state = engine.getState();
    const root = state.commits[headId(state)];
    state.mockServers.origin = { branches: { main: root.id }, commits: { [root.id]: root } };
    // Hide an object from local history while retaining it on the simulated server.
    state.commits = {};
    state.branches.main = '';
    state.reflog = [];
    engine.loadState(state);
    run(engine, ['git add .', 'git commit -m "Independent local root"']);
    expect(headId(engine.getState())).not.toBe(root.id);
    expect(engine.getState().mockServers.origin.commits[root.id]).toEqual(root);
  });

  it('preserves an existing mock merge ID and produces unique stash IDs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const scenario = githubScenarios.find(item => item.id === 'github-merge')!;
    const engine = new GitEngine(scenario.initialState);
    const state = engine.getState();
    const reserved = 'pr-' + (0.5).toString(36).slice(2, 9);
    state.mockServers.origin.commits[reserved] = { ...state.commits.c1, id: reserved, message: 'Retain this object' };
    engine.loadState(state);
    run(engine, ['simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge']);
    const server = engine.getState().mockServers.origin;
    expect(server.commits[reserved]).toEqual(state.mockServers.origin.commits[reserved]);
    expect(server.branches.main).not.toBe(reserved);

    run(engine, ['echo "first" > app.ts', 'git stash push', 'echo "second" > app.ts', 'git stash push']);
    const stash = engine.getState().stash;
    expect(stash).toHaveLength(2);
    expect(new Set(stash.map(item => item.id)).size).toBe(2);
    expect(stash.map(item => item.workingDirectory['app.ts'])).toEqual(['first', 'second']);
  });
});
