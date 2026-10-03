import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tokenizeCommand } from './command-input';
import { GitEngine } from './git-simulator';
import { scenarios } from './scenarios';
import { assessGoal } from './goal-checker';
import type { CommandResult } from '@/types/git';

describe('literal command input and recovery', () => {
  it.each(['echo "unfinished > README.md', "git commit -m 'unfinished", 'touch incomplete\\', 'git status && git init', 'ls | git log', 'echo "new" >> README.md'])('rejects unsupported or incomplete syntax without changing state: %s', command => {
    const scenario = scenarios.find(item => item.id === 'level-1-9')!;
    const engine = new GitEngine(scenario.initialState);
    const before = engine.getState();
    const result = engine.execute(command);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/引用符|バックスラッシュ|未対応/);
    expect(engine.getState()).toEqual(before);
    expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
  });
  it('preserves literal quotes, spaces, special names and a quoted redirect symbol', () => {
    expect(tokenizeCommand('echo "a"\'b\'\\ c > "constructor/日本 語.txt"').tokens).toEqual([{ text: 'echo' }, { text: 'ab c' }, { text: '>', redirect: true }, { text: 'constructor/日本 語.txt' }]);
    const engine = new GitEngine();
    expect(engine.execute('echo \'"quoted" > literal\' > "constructor/日本 語.txt"').success).toBe(true);
    expect(engine.getState().workingDirectory['constructor/日本 語.txt']).toBe('"quoted" > literal');
    expect(engine.execute('echo ">" > symbol.txt').success).toBe(true);
    expect(engine.getState().workingDirectory['symbol.txt']).toBe('>');
  });
  it.each(['init', 'add .', 'log', 'show HEAD', 'diff', 'reflog', 'blame README.md', 'branch feature', 'checkout main', 'reset --soft HEAD', 'stash push', 'remote -v', 'fetch origin', 'push origin main', 'pull origin main', 'merge feature', 'rebase main', 'cherry-pick HEAD', 'revert HEAD', 'restore README.md', 'mv README.md other', 'config user.name Learner', 'tag sample', 'worktree list', 'bisect start', 'sparse-checkout init', 'submodule status', 'lfs install'])('rejects an unknown option without mutation: git %s', command => {
    const engine = new GitEngine(scenarios.find(item => item.id === 'level-1-9')!.initialState);
    const before = engine.getState();
    const result = engine.execute(`git ${command} --not-a-real-option`);
    expect(result.success).toBe(false);
    expect(result.message).toContain('オプション');
    expect(engine.getState()).toEqual(before);
  });
  it.each(['gh pr view 1', 'gh pr checks 1', 'simulate review approve 1', 'simulate ci pass 1'])('rejects unknown mock GitHub flags before state mutation: %s', command => {
    const engine = new GitEngine(scenarios.find(item => item.id === 'github-merge')!.initialState);
    const before = engine.getState();
    expect(engine.execute(command + ' --not-a-real-option').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });
  it.each(['gh pr view 1 > output.txt', 'simulate review approve 1 > output.txt', 'git status > output.txt', 'git add README.md > output.txt'])('rejects output redirection outside the supported echo syntax without mutation: %s', command => {
    const scenario = scenarios.find(item => item.id === 'github-view')!;
    const engine = new GitEngine(scenario.initialState);
    const before = engine.getState(); const result = engine.execute(command);
    expect(result.success).toBe(false);
    expect(result.message).toContain('リダイレクト');
    expect(engine.getState()).toEqual(before);
    expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
  });
  it('does not pass a log task for an ignored extra target or missing filter value', () => {
    const scenario = scenarios.find(item => item.id === 'level-1-6')!;
    const engine = new GitEngine(scenario.initialState);
    for (const command of ['git log missing-ref', 'git log --grep', 'git log --']) {
      const result = engine.execute(command);
      expect(result.success).toBe(false);
      expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
    }
  });
  it('rolls back a partially mutated command after an unexpected engine exception, then remains usable', () => {
    const engine = new GitEngine(scenarios.find(item => item.id === 'level-1-5')!.initialState);
    const before = engine.getState();
    const internal = engine as unknown as { executeCommand(command: string): CommandResult };
    const original = internal.executeCommand.bind(engine);
    const spy = vi.spyOn(internal, 'executeCommand').mockImplementationOnce(command => {
      original(command);
      throw new Error('injected after commit');
    });
    const result = engine.execute('git commit -m "First commit"');
    expect(result.success).toBe(false);
    expect(result.message).toContain('直前へ戻しました');
    expect(engine.getState()).toEqual(before);
    spy.mockRestore();
    expect(engine.execute('git commit -m "First commit"').success).toBe(true);
  });
});


describe('real Git comparison for reviewed input paths', () => {
  it('rejects unknown options in both engines without altering the real or simulated repository', () => {
    const directory = mkdtempSync(join(tmpdir(), 'git-learning-input-'));
    const git = (args: string[]) => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    try {
      expect(git(['init', '-b', 'main']).status).toBe(0);
      git(['config', 'user.name', 'Learning test']); git(['config', 'user.email', 'test@example.invalid']);
      writeFileSync(join(directory, 'README.md'), 'Hello');
      git(['add', 'README.md']); expect(git(['commit', '-m', 'Initial']).status).toBe(0);
      const engine = new GitEngine(scenarios.find(item => item.id === 'level-1-9')!.initialState);
      const state = engine.getState(); const head = git(['rev-parse', 'HEAD']).stdout;
      for (const args of [['init'], ['log'], ['diff'], ['show', 'HEAD'], ['branch', 'other'], ['checkout', 'main'], ['reset', '--soft', 'HEAD'], ['stash', 'push'], ['restore', 'README.md'], ['tag', 'test']]) {
        const command = [...args, '--not-a-real-option'];
        expect(git(command).status, command.join(' ')).not.toBe(0);
        expect(engine.execute('git ' + command.join(' ')).success).toBe(false);
        expect(engine.getState()).toEqual(state);
        expect(git(['rev-parse', 'HEAD']).stdout).toBe(head);
        expect(git(['status', '--porcelain']).stdout).toBe('');
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('keeps quoted commit messages and spaced paths identical to the real shell/Git subset', () => {
    const directory = mkdtempSync(join(tmpdir(), 'git-learning-quotes-'));
    const shell = (command: string) => spawnSync('/bin/sh', ['-c', command], { cwd: directory, encoding: 'utf8' });
    try {
      expect(shell('git init -b main').status).toBe(0);
      shell('git config user.name Learner'); shell('git config user.email test@example.invalid');
      const engine = new GitEngine();
      // Authored constant commands only; no learner input is executed by the real shell.
      const commands = [
        `echo '"literal" > content' > "space name.txt"`,
        'git add "space name.txt"',
        `git commit -m 'Title "quoted"'`,
      ];
      for (const command of commands) {
        expect(shell(command).status, command).toBe(0);
        expect(engine.execute(command).success, command).toBe(true);
      }
      const state = engine.getState(); const commit = state.commits[state.branches.main];
      expect(shell('git log -1 --format=%B').stdout.trim()).toBe(commit.message);
      // This simulator stores echo content without the shell's trailing newline.
      expect(shell('git show "HEAD:space name.txt"').stdout.trimEnd()).toBe(state.workingDirectory['space name.txt']);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
