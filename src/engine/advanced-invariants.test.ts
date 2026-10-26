import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitEngine } from './git-simulator';
import { advancedScenarios } from './advanced-scenarios';
import { interactiveScenarios } from './interactive-scenarios';
import { scenarios } from './scenarios';
import { headId, headTree, indexTree } from './git-state';
import { assertGitState } from './invariant-test-helpers';
import { parseSession, type SavedSession } from '@/learning/session-store';

afterEach(() => vi.restoreAllMocks());
const ids = new Set(scenarios.map(item => item.id));
function resume(engine: GitEngine): GitEngine {
  const saved: SavedSession = { version: 1, scenarioId: null, state: engine.getState(), output: [], history: [], hintLevel: 0, lastAttempt: null };
  return new GitEngine(parseSession(JSON.stringify(saved), ids).state);
}
function run(engine: GitEngine, command: string, success = true) {
  const before = engine.getState();
  const result = engine.execute(command);
  expect(result.success, command).toBe(success);
  assertGitState(engine.getState(), command);
  if (!success) expect(engine.getState(), command).toEqual(before);
  return result;
}
function stable(seed: number) {
  let value = seed >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000));
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + seed);
}

describe('advanced operations and checkpoint invariants', () => {
  it('the invariant oracle rejects cycles, broken refs and invalid advanced state', () => {
    const state = () => new GitEngine(advancedScenarios.find(item => item.id === 'advanced-sparse')!.initialState).getState();
    const mutations: ((value: ReturnType<typeof state>) => void)[] = [
      value => { value.commits.c1.parents = ['c1']; },
      value => { value.branches.main = 'missing'; },
      value => { value.HEAD = { type: 'branch', value: 'missing' }; },
      value => { value.index['app.ts'] = { path: 'wrong.ts', status: 'staged', content: 'draft' }; },
      value => { value.worktrees = { '/other': { branch: 'missing', workingDirectory: {}, index: {} } }; },
      value => { value.patchSession = { path: 'app.ts', cursor: 2, chunks: [{ before: 'a', after: 'b', changed: true }] }; },
      value => { value.bisect = { original: state(), good: 'missing' }; },
      value => { value.operation = { kind: 'rebase', original: state(), remaining: ['missing'] }; },
    ];
    for (const mutate of mutations) { const value = state(); mutate(value); expect(() => assertGitState(value, 'oracle check')).toThrow(); }
  });
  it.each([1, 42, 20261025, 0xc0ffee])('mixed worktree/sparse/patch/bisect/todo sequences: seed %i', seed => {
    stable(seed);
    let choice = seed >>> 0;
    const pick = (length: number) => ((choice = (Math.imul(choice, 1103515245) + 12345) >>> 0) % length);
    let engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-sparse')!.initialState);
    for (let index = 0; index < 4; index++) for (const command of [`echo "base ${index}" > src/app.ts`, 'git add .', `git commit -m "Base ${index}"`]) run(engine, command);
    run(engine, 'git worktree add -b hotfix ../hotfix main');
    let transitions = 0;
    const trace: string[] = [];
    const execute = (command: string) => {
      trace.push(command);
      const context = `seed ${seed}: ${trace.join(' → ')}`;
      const before = engine.getState();
      const result = engine.execute(command);
      const after = engine.getState();
      expect(result.message, context).not.toContain('予期しないエラー');
      assertGitState(after, context);
      if (!result.success && !result.newState) expect(after, context).toEqual(before);
      if (JSON.stringify(before) !== JSON.stringify(after)) transitions++;
      for (const [id, commit] of Object.entries(before.commits)) expect(after.commits[id], context).toEqual(commit);
    };
    for (let step = 0; step < 120; step++) {
      const state = engine.getState();
      if (state.patchSession) execute(['y', 'n', 'q', 'git reset --hard'][pick(4)]);
      else if (state.operation?.awaiting === 'todo') {
        const actions = ['pick', 'drop', 'fixup', 'squash', 'reword', 'edit'];
        engine.setRebaseTodo(state.operation.remaining.map((id, index) => `${index === 0 ? 'pick' : actions[pick(actions.length)]} ${id}`).join('\n'));
        execute('git rebase --continue');
      } else if (state.unmergedPaths?.length) {
        for (const path of state.unmergedPaths) { execute(`echo "resolved ${step}" > "${path}"`); execute(`git add "${path}"`); }
        execute(state.operation ? `git ${state.operation.kind} --continue` : 'git commit -m "Resolved"');
      } else if (state.operation) {
        if (state.operation.awaiting) execute(`git commit --amend -m "Edited ${step}"`);
        execute('git rebase --continue');
      } else {
        const commands = ['cd /workspace/project', 'cd /workspace/hotfix', 'git worktree list', 'git sparse-checkout set src', 'git sparse-checkout set tests', 'git sparse-checkout disable', `echo "draft ${step}" > src/app.ts`, 'git add -p src/app.ts', 'git add .', `git commit -m "Step ${step}"`, 'git stash push -u', 'git stash pop', 'git bisect start', 'git bisect good HEAD~2', 'git bisect bad HEAD', 'git bisect reset', 'git rebase -i HEAD~2', 'git status'];
        execute(commands[pick(commands.length)]);
      }
      if (step % 11 === 0) {
        const before = engine.getState(); engine = resume(engine);
        expect(engine.getState(), `seed ${seed}, checkpoint ${step}`).toEqual(before);
      }
    }
    expect(transitions, `seed ${seed}`).toBeGreaterThanOrEqual(15);
  });

  it.each([1, 42, 20261025, 0xc0ffee])('worktree isolation and dirty removal: seed %i', seed => {
    stable(seed);
    let engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-worktree-add')!.initialState);
    run(engine, 'git worktree add -b hotfix ../hotfix main');
    run(engine, 'echo "main note" > notes.txt');
    run(engine, 'git add app.ts');
    const main = engine.getState();
    for (let round = 0; round < 5; round++) {
      run(engine, 'cd ../hotfix');
      run(engine, `echo "hotfix ${seed}-${round}" > hotfix.txt`);
      run(engine, 'git add hotfix.txt');
      engine = resume(engine);
      run(engine, 'cd ../project');
      expect(engine.getState().workingDirectory).toEqual(main.workingDirectory);
      expect(engine.getState().index).toEqual(main.index);
      run(engine, 'git branch -D hotfix', false);
      run(engine, 'git worktree remove ../hotfix', false);
      run(engine, 'cd ../hotfix');
      run(engine, `git commit -m "Hotfix ${round}"`);
      run(engine, 'cd ../project');
    }
    run(engine, 'git worktree remove ../hotfix');
    expect(engine.getState().branches.hotfix).toBeTruthy();
    expect(engine.getState().workingDirectory['notes.txt']).toBe('main note');
  });

  it.each([1, 42, 20261025, 0xc0ffee])('sparse transitions never stage hidden files as deletion: seed %i', seed => {
    stable(seed);
    let engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-sparse')!.initialState);
    run(engine, 'echo "private" > scratch/notes.txt');
    const hidden = headTree(engine.getState())['tests/spec.ts'];
    for (let round = 0; round < 5; round++) {
      run(engine, 'git sparse-checkout set src');
      run(engine, `echo "edit ${seed}-${round}" > src/app.ts`);
      run(engine, 'git sparse-checkout disable', false);
      run(engine, 'echo "blocked" > tests/spec.ts', false);
      run(engine, 'git add .');
      expect(indexTree(engine.getState())['tests/spec.ts']).toBe(hidden);
      engine = resume(engine);
      run(engine, `git commit -m "Sparse ${round}"`);
      expect(headTree(engine.getState())['tests/spec.ts']).toBe(hidden);
      run(engine, 'git sparse-checkout disable');
      expect(engine.getState().workingDirectory['tests/spec.ts']).toBe(hidden);
      expect(engine.getState().workingDirectory['scratch/notes.txt']).toBe('private');
    }
  });

  it.each([1, 42, 20261025, 0xc0ffee])('bisect checkpoints and reset preserve the investigation result: seed %i', seed => {
    stable(seed);
    let engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-bisect-find')!.initialState);
    const original = engine.getState();
    run(engine, 'echo "private" > notes.txt');
    run(engine, 'git bisect start'); run(engine, 'git bisect bad c5'); run(engine, 'git bisect good c1');
    engine = resume(engine);
    run(engine, 'git bisect good missing', false);
    for (let step = 0; step < 5 && !engine.getState().bisect?.found; step++) {
      run(engine, headTree(engine.getState())['app.ts'] === 'bad' ? 'git bisect bad' : 'git bisect good');
      engine = resume(engine);
    }
    expect(engine.getState().bisect?.found).toBe('c3');
    run(engine, 'git bisect reset');
    expect(engine.getState().HEAD).toEqual(original.HEAD);
    expect(engine.getState().lastBisectFound).toBe('c3');
    expect(engine.getState().workingDirectory['notes.txt']).toBe('private');
  });

  it('bisect reset keeps commits, stash, tags and settings created during investigation', () => {
    stable(42);
    const engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-bisect-find')!.initialState);
    for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'echo "investigation" > app.ts', 'git add app.ts', 'git commit -m "Investigation"', 'git tag investigation', 'git config user.name Inspector', 'echo "stash memo" > app.ts', 'git stash push']) run(engine, command);
    const before = engine.getState();
    const investigation = headId(before);
    run(engine, 'git bisect reset');
    const after = engine.getState();
    expect(after.HEAD).toEqual({ type: 'branch', value: 'main' });
    expect(after.commits[investigation]).toEqual(before.commits[investigation]);
    expect(after.stash).toEqual(before.stash);
    expect(after.tags).toEqual(before.tags);
    expect(after.config).toEqual(before.config);
  });

  it('every authored solution preserves history/ref/index invariants at each step', () => {
    for (const scenario of scenarios) {
      const engine = new GitEngine(scenario.initialState);
      assertGitState(engine.getState(), `${scenario.id}: initial`);
      for (const command of scenario.solution ?? []) {
        engine.execute(command);
        assertGitState(engine.getState(), `${scenario.id}: ${command}`);
      }
    }
  });

  it('bisect reset uses the current original-branch tip and refuses untracked overwrite', () => {
    stable(42);
    const engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-bisect-find')!.initialState);
    for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'git switch main', 'echo "committed" > notes.txt', 'git add notes.txt', 'git commit -m "Moved main"']) run(engine, command);
    const target = headId(engine.getState());
    for (const command of ['git switch --detach c3', 'echo "private" > notes.txt']) run(engine, command);
    run(engine, 'git bisect reset', false);
    run(engine, 'rm notes.txt'); run(engine, 'git bisect reset');
    expect(headId(engine.getState())).toBe(target);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('committed');
  });

  it('bisect reset refuses a removed original branch and can restore an original detached HEAD', () => {
    const engine = new GitEngine(advancedScenarios.find(item => item.id === 'advanced-bisect-find')!.initialState);
    for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'git branch -m main renamed']) run(engine, command);
    run(engine, 'git bisect reset', false);
    run(engine, 'git branch -m renamed main'); run(engine, 'git bisect reset');
    run(engine, 'git switch --detach c4');
    for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'git bisect reset']) run(engine, command);
    expect(engine.getState().HEAD).toEqual({ type: 'commit', value: 'c4' });
    expect(engine.getState().detachedHead).toBe(true);
  });

  it.each(['y', 'n', 'q'])('partial staging checkpoint preserves selected content after %s', answer => {
    let engine = new GitEngine();
    for (const command of ['echo "one\nkeep\nthree\n" > app.ts', 'git add .', 'git commit -m "Root"', 'echo "ONE\nkeep\nTHREE\n" > app.ts', 'git add -p app.ts']) run(engine, command);
    engine = resume(engine);
    const before = engine.getState();
    run(engine, 'git reset --hard', false);
    run(engine, answer);
    expect(headTree(engine.getState())).toEqual(headTree(before));
    expect(engine.getState().workingDirectory).toEqual(before.workingDirectory);
    if (answer === 'q') expect(engine.getState().index).toEqual(before.index);
    if (answer === 'y') expect(indexTree(engine.getState())['app.ts']).toContain('ONE');
    while (engine.getState().patchSession) run(engine, 'n');
    engine = resume(engine);
    expect(engine.getState().patchSession).toBeUndefined();
  });

  it.each(['pick', 'drop', 'fixup', 'squash', 'reword', 'edit'])('todo action %s survives checkpoints and invalid edits', action => {
    stable(42);
    let engine = new GitEngine(interactiveScenarios.find(item => item.id === 'interactive-fixup')!.initialState);
    run(engine, 'git rebase -i HEAD~2');
    engine.setRebaseTodo('pick c2\npick c2');
    run(engine, 'git rebase --continue', false);
    engine.setRebaseTodo(`pick c2\n${action} c3`);
    engine = resume(engine);
    run(engine, 'git rebase --continue');
    if (['reword', 'edit'].includes(action)) {
      expect(engine.getState().operation?.awaiting).toBe(action);
      engine = resume(engine);
      run(engine, 'git commit --amend -m "Rewritten"');
      run(engine, 'git rebase --continue');
      expect(headTree(engine.getState())['README.md']).toBe('Docs');
    }
    expect(engine.getState().operation).toBeUndefined();
    assertGitState(engine.getState(), action);
  });
});
