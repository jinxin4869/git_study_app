import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitEngine } from './git-simulator';
import { headTree, indexTree } from './git-state';
import { checkGoal } from './goal-checker';
import { scenarios } from './scenarios';
import { operationScenarios } from './operation-scenarios';

function stagedEngine() {
  const engine = new GitEngine();
  for (const command of ['echo "base" > file.txt', 'git add file.txt', 'git commit -m "Initial"', 'echo "draft" > file.txt', 'git add file.txt']) {
    expect(engine.execute(command).success, command).toBe(true);
  }
  return engine;
}

describe('Argument validation preserves repository state', () => {
  it.each([
    'git status --not-a-real-option', 'git status -s', 'git status --ignored --bad',
    'git status file.txt', 'git commit --not-a-real-option -m "bad"',
    'git commit -m "bad" --not-a-real-option', 'git commit -a -m "bad"',
    'git commit -m', 'git commit -m "bad" file.txt', 'git commit --no-edit',
  ])('rejects %s without changing HEAD, index, files or reflog', command => {
    const engine = stagedEngine();
    const before = engine.getState();
    const result = engine.execute(command);
    expect(result.success).toBe(false);
    expect(result.message).not.toBe('');
    expect(result.newState).toBeUndefined();
    expect(engine.getState()).toEqual(before);
  });

  it('keeps supported status flags and amend operations working', () => {
    const engine = stagedEngine();
    expect(engine.execute('git status --ignored').success).toBe(true);
    expect(engine.execute('git commit --amend --no-edit').success).toBe(true);
    expect(headTree(engine.getState())['file.txt']).toBe('draft');
  });

  it.each(['--amend', '--no-edit', '--not-a-real-option'])('treats the message %s as content rather than an option', message => {
    const engine = stagedEngine();
    const parent = engine.getState().branches.main;
    expect(engine.execute(`git commit -m "${message}"`).success).toBe(true);
    const state = engine.getState();
    expect(state.commits[state.branches.main].message).toBe(message);
    expect(state.commits[state.branches.main].parents).toEqual([parent]);
  });

  it('combines repeated -m values into paragraphs', () => {
    const engine = stagedEngine();
    expect(engine.execute('git commit -m "Subject" -m "Details"').success).toBe(true);
    const state = engine.getState();
    expect(state.commits[state.branches.main].message).toBe('Subject\n\nDetails');
  });

  it.each(['git rm --bad file.txt', 'git rm -f file.txt other.txt'])('rejects unsupported removal arguments: %s', command => {
    const engine = stagedEngine();
    const before = engine.getState();
    expect(engine.execute(command).success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });

  it('supports the -- separator for a filename beginning with a hyphen', () => {
    const engine = new GitEngine();
    engine.touch('-file.txt', 'base');
    engine.execute('git add .');
    engine.execute('git commit -m "Initial"');
    expect(engine.execute('git rm -- -file.txt').success).toBe(true);
    expect(indexTree(engine.getState())['-file.txt']).toBeUndefined();
    expect(engine.getState().workingDirectory['-file.txt']).toBeUndefined();
  });
});

describe('Conflict resolution grading', () => {
  const scenario = scenarios.find(item => item.id === 'level-7-3')!;
  it.each(['', 'unrelated', '<html>\n<body>\n</body>\n</html>', '<h1>Hello World</h1>'])('rejects incomplete content %j', content => {
    const engine = new GitEngine(scenario.initialState);
    engine.touch('index.html', content);
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
  });

  it.each(['World', 'Git'])('accepts a complete %s resolution', title => {
    const engine = new GitEngine(scenario.initialState);
    engine.touch('index.html', `<html>\n<body>\n<h1>Hello ${title}</h1>\n</body>\n</html>`);
    expect(checkGoal(engine.getState(), scenario)).toBe(true);
  });

  it('accepts both complete sides and rejects leftover markers in another file', () => {
    const engine = new GitEngine(scenario.initialState);
    const both = '<html>\n<body>\n<h1>Hello World</h1>\n<h1>Hello Git</h1>\n</body>\n</html>';
    engine.touch('index.html', both);
    expect(checkGoal(engine.getState(), scenario)).toBe(true);
    engine.touch('other.txt', '>>>>>>> feature');
    expect(checkGoal(engine.getState(), scenario)).toBe(false);
  });

  it('requires exercise-specific accepted content, including explicitly allowed empty results', () => {
    const engine = new GitEngine(scenario.initialState);
    engine.touch('index.html', '');
    expect(checkGoal(engine.getState(), { ...scenario, goal: { type: 'conflict_resolved', params: { name: 'index.html' } } })).toBe(false);
    expect(checkGoal(engine.getState(), { ...scenario, goal: { type: 'conflict_resolved', params: { name: 'index.html', acceptedContents: [''] } } })).toBe(true);
  });
});

describe('Conflict resolution sessions', () => {
  function mergeEngine() {
    const engine = new GitEngine(scenarios.find(item => item.id === 'level-7-1')!.initialState);
    expect(engine.execute('git merge feature').success).toBe(false);
    return engine;
  }

  it('refuses an old result after abort and even after recreating identical conflict text', () => {
    const engine = mergeEngine();
    const session = engine.openConflictResolution('index.html')!;
    expect(session).not.toBeNull();
    expect(engine.execute('git merge --abort').success).toBe(true);
    const restored = engine.getState();
    expect(engine.resolveConflict(session, 'obsolete result').success).toBe(false);
    expect(engine.getState()).toEqual(restored);
    expect(engine.execute('git merge feature').success).toBe(false);
    expect(engine.getState().workingDirectory['index.html']).toBe(session.content);
    const conflicted = engine.getState();
    expect(engine.resolveConflict(session, 'obsolete result').success).toBe(false);
    expect(engine.getState()).toEqual(conflicted);
  });

  it.each([
    ['operation-rebase-continue', 'git rebase main', 'git rebase --abort'],
    ['operation-rebase-continue', 'git rebase main', 'git rebase --skip'],
    ['operation-pick-continue', 'git cherry-pick c3', 'git cherry-pick --abort'],
    ['operation-pick-continue', 'git cherry-pick c3', 'git cherry-pick --skip'],
    ['operation-revert-continue', 'git revert c2', 'git revert --abort'],
    ['operation-revert-continue', 'git revert c2', 'git revert --skip'],
  ])('%s cannot apply a draft after %s / %s', (id, begin, end) => {
    const engine = new GitEngine(operationScenarios.find(item => item.id === id)!.initialState);
    expect(engine.execute(begin).success).toBe(false);
    const session = engine.openConflictResolution('app.ts')!;
    expect(session).not.toBeNull();
    expect(engine.execute(end).success).toBe(true);
    const before = engine.getState();
    expect(engine.resolveConflict(session, 'obsolete result').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });

  it('keeps decisions across read-only and rejected commands, and applies a result only once', () => {
    const engine = mergeEngine();
    const session = engine.openConflictResolution('index.html')!;
    expect(engine.execute('git status').success).toBe(true);
    expect(engine.execute('git commit --bad -m "bad"').success).toBe(false);
    expect(engine.isConflictResolutionCurrent(session)).toBe(true);
    expect(engine.resolveConflict(session, 'resolved').success).toBe(true);
    expect(engine.getState().workingDirectory['index.html']).toBe('resolved');
    const before = engine.getState();
    expect(engine.resolveConflict(session, 'second result').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });

  it.each(['edit', 'reload', 'reset'])('invalidates a draft after %s', action => {
    const engine = mergeEngine();
    const session = engine.openConflictResolution('index.html')!;
    if (action === 'edit') {
      engine.touch('index.html', 'updated');
      engine.touch('index.html', session.content);
    } else if (action === 'reload') engine.loadState(engine.getState());
    else expect(engine.execute('git reset --hard HEAD').success).toBe(true);
    const before = engine.getState();
    expect(engine.resolveConflict(session, 'obsolete result').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });
});

const removalCases = [
  { label: 'clean', head: 'base', index: 'base', working: 'base' },
  { label: 'unstaged edit', head: 'base', index: 'base', working: 'draft' },
  { label: 'staged edit', head: 'base', index: 'draft', working: 'draft' },
  { label: 'staged edit reverted in worktree', head: 'base', index: 'draft', working: 'base' },
  { label: 'staged and unstaged edits', head: 'base', index: 'draft', working: 'other' },
  { label: 'missing working file', head: 'base', index: 'base', working: undefined },
  { label: 'staged edit with missing file', head: 'base', index: 'draft', working: undefined },
  { label: 'new staged file', head: undefined, index: 'new', working: 'new' },
  { label: 'new staged file with edit', head: undefined, index: 'new', working: 'other' },
  { label: 'new staged file missing', head: undefined, index: 'new', working: undefined },
  { label: 'empty tracked file', head: '', index: '', working: '' },
];

describe('git rm compared with real Git', () => {
  for (const flags of [[], ['--cached'], ['-f'], ['--cached', '--force']]) {
    it.each(removalCases)(`rm ${flags.join(' ')}: $label`, fixture => {
      const directory = mkdtempSync(join(tmpdir(), 'git-study-rm-test-'));
      const file = join(directory, 'file.txt');
      const git = (...args: string[]) => spawnSync('git', [
        '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=/dev/null', ...args,
      ], { cwd: directory, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
      const runGit = (...args: string[]) => {
        const result = git(...args);
        expect(result.status, result.stderr).toBe(0);
        return result.stdout;
      };
      try {
        runGit('init', '-q');
        writeFileSync(join(directory, '.keep'), 'keep');
        if (fixture.head !== undefined) writeFileSync(file, fixture.head);
        runGit('add', '.');
        runGit('commit', '-qm', 'Initial');
        writeFileSync(file, fixture.index);
        runGit('add', 'file.txt');
        if (fixture.working === undefined) unlinkSync(file);
        else writeFileSync(file, fixture.working);

        const engine = new GitEngine();
        engine.touch('.keep', 'keep');
        if (fixture.head !== undefined) engine.touch('file.txt', fixture.head);
        engine.execute('git add .');
        engine.execute('git commit -m "Initial"');
        engine.touch('file.txt', fixture.index);
        engine.execute('git add file.txt');
        if (fixture.working === undefined) engine.execute('rm file.txt');
        else engine.touch('file.txt', fixture.working);
        const before = engine.getState();

        const real = git('rm', ...flags, 'file.txt');
        const simulated = engine.execute(['git rm', ...flags, 'file.txt'].join(' '));
        expect(simulated.success, real.stderr).toBe(real.status === 0);
        if (!simulated.success) expect(engine.getState()).toEqual(before);
        const indexed = git('show', ':file.txt');
        expect(indexTree(engine.getState())['file.txt']).toBe(indexed.status === 0 ? indexed.stdout : undefined);
        expect(headTree(engine.getState())['file.txt']).toBe(fixture.head);
        const working = flags.includes('--cached') || real.status !== 0 ? fixture.working : undefined;
        expect(engine.getState().workingDirectory['file.txt']).toBe(working);
        if (working !== undefined) expect(readFileSync(file, 'utf8')).toBe(working);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
