import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitEngine } from './git-simulator';
import { headTree, indexTree } from './git-state';

describe('switch and checkout compared with real Git', () => {
  it.each([
    ['switch', 'HEAD'], ['switch', 'HEAD~1'], ['switch', 'OLD'], ['switch', 'v1'],
    ['switch', '--detach'], ['switch', '--detach', 'HEAD~1'], ['switch', 'feature'],
    ['switch', '-c', 'new', 'HEAD~1'], ['switch', 'main', 'extra'],
    ['checkout', 'HEAD'], ['checkout', 'HEAD~0'], ['checkout', 'OLD'],
  ].map(args => ({ command: args.join(' '), args })))('$command', ({ args }) => {
    const directory = mkdtempSync(join(tmpdir(), 'git-study-switch-test-'));
    const git = (...arguments_: string[]) => spawnSync('git', [
      '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=/dev/null', ...arguments_,
    ], { cwd: directory, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
    const runGit = (...arguments_: string[]) => {
      const result = git(...arguments_);
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    try {
      runGit('init', '-q', '-b', 'main');
      writeFileSync(join(directory, 'file.txt'), 'base');
      runGit('add', '.');
      runGit('commit', '-qm', 'Initial');
      const old = runGit('rev-parse', 'HEAD');
      runGit('branch', 'feature');
      runGit('tag', 'v1');
      writeFileSync(join(directory, 'file.txt'), 'main');
      runGit('add', '.');
      runGit('commit', '-qm', 'Main');
      const engine = new GitEngine();
      for (const command of ['echo "base" > file.txt', 'git add .', 'git commit -m "Initial"', 'git branch feature', 'git tag v1', 'echo "main" > file.txt', 'git add .', 'git commit -m "Main"']) {
        expect(engine.execute(command).success, command).toBe(true);
      }
      const before = engine.getState();
      const real = git(...args.map(arg => arg === 'OLD' ? old : arg));
      const simulated = engine.execute(['git', ...args.map(arg => arg === 'OLD' ? before.branches.feature : arg)].join(' '));
      expect(simulated.success, real.stderr).toBe(real.status === 0);
      if (!simulated.success) expect(engine.getState()).toEqual(before);
      const branch = git('symbolic-ref', '--short', 'HEAD');
      const state = engine.getState();
      expect(state.detachedHead).toBe(branch.status !== 0);
      if (branch.status === 0) expect(state.HEAD).toEqual({ type: 'branch', value: branch.stdout.trim() });
      expect(headTree(state)['file.txt']).toBe(runGit('show', 'HEAD:file.txt'));
      expect(indexTree(state)['file.txt']).toBe(runGit('show', ':file.txt'));
      expect(state.workingDirectory['file.txt']).toBe(readFileSync(join(directory, 'file.txt'), 'utf8'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Special filenames and reference names', () => {
  it.each(['constructor', 'toString', '__proto__', 'constructor/file.txt', 'toString/file.txt', '__proto__/file.txt', '日本語/空 白.txt', '-file.txt'])('preserves %s through add, commit, edit, reset and deletion', path => {
    const engine = new GitEngine();
    engine.touch(path, 'base');
    expect(engine.getState().workingDirectory[path]).toBe('base');
    expect(engine.execute('git add .').success).toBe(true);
    expect(engine.execute('git commit -m "Initial"').success).toBe(true);
    expect(headTree(engine.getState())[path]).toBe('base');
    engine.touch(path, 'draft');
    expect(engine.execute('git status').message).toContain(`modified: ${path}`);
    expect(engine.execute('git reset --hard HEAD').success).toBe(true);
    expect(engine.getState().workingDirectory[path]).toBe('base');
    engine.loadState(JSON.parse(JSON.stringify(engine.getState())));
    engine.touch(path, 'stashed');
    expect(engine.execute('git stash push').success).toBe(true);
    expect(engine.getState().workingDirectory[path]).toBe('base');
    expect(engine.execute('git stash pop').success).toBe(true);
    expect(engine.getState().workingDirectory[path]).toBe('stashed');
    expect(engine.execute('git reset --hard HEAD').success).toBe(true);
    expect(engine.execute(`git rm -- "${path}"`).success).toBe(true);
    expect(engine.execute('git commit -m "Delete"').success).toBe(true);
    expect(headTree(engine.getState())[path]).toBeUndefined();
    expect(engine.getState().workingDirectory[path]).toBeUndefined();
  });

  it.each(['constructor', 'toString', '__proto__'])('can create and switch to the reference %s', name => {
    const engine = new GitEngine();
    engine.touch('file.txt', 'base');
    engine.execute('git add .');
    engine.execute('git commit -m "Initial"');
    expect(engine.execute(`git switch ${name}`).success).toBe(false);
    expect(engine.execute(`git switch -c ${name}`).success).toBe(true);
    expect(engine.getState().HEAD).toEqual({ type: 'branch', value: name });
    expect(engine.execute('git switch main').success).toBe(true);
    expect(engine.execute(`git switch ${name}`).success).toBe(true);
    expect(engine.execute(`git tag ${name}`).success).toBe(true);
    expect(engine.execute(`git checkout --detach ${name}`).success).toBe(true);
    expect(engine.getState().detachedHead).toBe(true);
  });
});
