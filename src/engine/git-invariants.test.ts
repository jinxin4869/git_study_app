import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitEngine } from './git-simulator';
import type { Commit, GitState } from '@/types/git';

afterEach(() => vi.restoreAllMocks());

// Fixed seeds make a failure reproducible without an additional property-test dependency.
function random(seed: number) {
  let value = seed >>> 0;
  return (length: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % length;
  };
}

function assertHistory(commits: Record<string, Commit>, refs: string[], context: string) {
  for (const id of refs) expect(Object.hasOwn(commits, id), `${context}: ref ${id}`).toBe(true);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    expect(visiting.has(id), `${context}: parent cycle at ${id}`).toBe(false);
    if (visited.has(id)) return;
    const commit = commits[id];
    expect(commit, `${context}: missing parent ${id}`).toBeDefined();
    expect(commit.id, context).toBe(id);
    visiting.add(id);
    for (const parent of commit.parents) visit(parent);
    visiting.delete(id);
    visited.add(id);
    for (const content of Object.values(commit.tree)) expect(typeof content, context).toBe('string');
  };
  for (const id of Object.keys(commits)) visit(id);
}

function assertState(state: GitState, context: string) {
  const head = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
  assertHistory(state.commits, [head, ...Object.values(state.branches), ...Object.values(state.remoteBranches), ...Object.values(state.tags ?? {}).map(tag => tag.commitId), ...(state.reflog ?? []).map(entry => entry.id)], context);
  expect(state.detachedHead, context).toBe(state.HEAD.type === 'commit');
  expect(new Set(state.unmergedPaths).size, context).toBe(state.unmergedPaths?.length ?? 0);
  for (const [path, entry] of Object.entries(state.index)) {
    expect(entry.path, context).toBe(path);
    if (entry.status !== 'deleted') expect(typeof entry.content, context).toBe('string');
  }
  for (const content of Object.values(state.workingDirectory)) expect(typeof content, context).toBe('string');
  for (const server of Object.values(state.mockServers)) {
    assertHistory(server.commits, [...Object.values(server.branches), ...Object.values(server.tags ?? {}).map(tag => tag.commitId)], `${context}: mock remote`);
  }
}

describe('seeded operation sequences preserve repository invariants', () => {
  it.each([1, 42, 0xc0ffee, 20261025])('seed %i', seed => {
    const pick = random(seed);
    // IDs influence Object.keys ordering and replay targets; seed them independently.
    const idRandom = random(seed ^ 0x5eed1234);
    vi.spyOn(Math, 'random').mockImplementation(() => idRandom(0x1_0000_0000) / 0x1_0000_0000);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + seed);
    const engine = new GitEngine();
    for (const command of [
      'echo "base" > app.ts', 'git add .', 'git commit -m "Root"',
      'git switch -c feature', 'echo "feature" > app.ts', 'git add .', 'git commit -m "Feature"',
      'git switch main', 'echo "main" > app.ts', 'git add .', 'git commit -m "Main"',
      'git remote add origin https://example.test/repo.git', 'git push -u origin main',
    ]) expect(engine.execute(command).success, command).toBe(true);

    const trace: string[] = [];
    let stateChanges = 0;
    const run = (command: string) => {
      trace.push(command);
      const context = `seed ${seed}, step ${trace.length}: ${trace.join(' → ')}`;
      const before = engine.getState();
      const result = engine.execute(command);
      const after = engine.getState();
      if (JSON.stringify(before) !== JSON.stringify(after)) stateChanges++;
      expect(result.message, context).not.toContain('予期しないエラー');
      assertState(after, context);
      // None of the sampled operations prunes objects: old snapshots must stay immutable.
      for (const [id, commit] of Object.entries(before.commits)) expect(after.commits[id], context).toEqual(commit);
      if (result.newState) expect(result.newState, context).toEqual(after);
    };

    // Start with a real conflict so the sequence also exercises interrupted operations.
    run('git merge feature');
    expect(engine.getState().unmergedPaths).toContain('app.ts');

    for (let step = 0; step < 160; step++) {
      const state = engine.getState();
      const ids = Object.keys(state.commits);
      const target = ids[pick(ids.length)];
      const paths = ['app.ts', 'README.md', '日本語 メモ.txt', 'constructor', '__proto__'];
      const path = paths[pick(paths.length)];
      const commands = [
        `echo "value ${seed}-${step}" > "${path}"`, `rm "${path}"`,
        'git add .', `git add "${path}"`, `git commit -m "Step ${step}"`,
        'git switch main', 'git switch feature', 'git switch topic', 'git branch topic', 'git branch -D topic',
        'git checkout --detach HEAD', 'git reset --soft HEAD~1', 'git reset --mixed HEAD~1', 'git reset --hard HEAD~1',
        'git merge feature', 'git merge main', 'git merge --abort',
        'git rebase main', 'git rebase --abort', 'git rebase --continue', 'git rebase --skip',
        `git cherry-pick ${target}`, 'git cherry-pick --abort', `git revert ${target}`, 'git revert --abort',
        'git stash push -u', 'git stash pop', 'git stash apply', 'git stash drop',
        'git tag sample', 'git tag -d sample', 'git fetch origin', 'git push origin main', 'git status', 'git log --oneline',
      ];
      if (state.unmergedPaths?.length && pick(3) === 0) {
        for (const conflict of state.unmergedPaths) {
          run(`echo "Resolved ${step}" > "${conflict}"`);
          run(`git add "${conflict}"`);
        }
        run(state.operation ? `git ${state.operation.kind} --continue` : 'git commit -m "Resolve"');
      } else run(commands[pick(commands.length)]);

      // Syntax rejection must not alter any state, even in the middle of an operation.
      const invalid = ['git reset --hard HEAD extra-path', 'git status --not-a-real-option', 'git commit --not-a-real-option', 'echo "unfinished'][pick(4)];
      const beforeRejected = engine.getState();
      expect(engine.execute(invalid).success, `seed ${seed}, step ${step}: ${invalid}`).toBe(false);
      expect(engine.getState(), `seed ${seed}, step ${step}: rejected command changed state`).toEqual(beforeRejected);
    }

    // A sequence of only rejected/read-only commands would make these checks vacuous.
    expect(stateChanges, `seed ${seed}: too few state transitions`).toBeGreaterThanOrEqual(15);

    const snapshot = engine.getState();
    snapshot.workingDirectory['external-change'] = 'not an engine edit';
    expect(engine.getState().workingDirectory['external-change']).toBeUndefined();
  });
});
