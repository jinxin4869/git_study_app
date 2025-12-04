import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from './git-simulator';

describe('GitEngine: diff', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('should show diff for modified files in working directory', () => {
    // 1. Create a file and commit it
    engine.execute('touch file.txt');
    engine.execute('echo "initial content" > file.txt');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "Initial commit"');

    // 2. Modify the file
    engine.execute('echo "modified content" > file.txt');

    // 3. Run git diff
    const result = engine.execute('git diff');
    expect(result.success).toBe(true);
    expect(result.message).toContain('diff --git a/file.txt b/file.txt');
    expect(result.message).toContain('-initial content');
    expect(result.message).toContain('+modified content');
  });

  it('should show diff for staged files with --cached', () => {
    // 1. Create a file and commit it
    engine.execute('touch file.txt');
    engine.execute('echo "initial content" > file.txt');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "Initial commit"');

    // 2. Modify and stage the file
    engine.execute('echo "staged content" > file.txt');
    engine.execute('git add file.txt');

    // 3. Run git diff --cached
    const result = engine.execute('git diff --cached');
    expect(result.success).toBe(true);
    expect(result.message).toContain('diff --git a/file.txt b/file.txt');
    expect(result.message).toContain('-initial content');
    expect(result.message).toContain('+staged content');
  });

  it('should show no diff if working directory matches index', () => {
    engine.execute('touch file.txt');
    engine.execute('echo "content" > file.txt');
    engine.execute('git add file.txt');

    const result = engine.execute('git diff');
    expect(result.success).toBe(true);
    expect(result.message).toBe('');
  });

  it('should show no diff if index matches HEAD with --cached', () => {
    engine.execute('touch file.txt');
    engine.execute('echo "content" > file.txt');
    engine.execute('git add file.txt');
    engine.execute('git commit -m "commit"');

    const result = engine.execute('git diff --cached');
    expect(result.success).toBe(true);
    expect(result.message).toBe('');
  });
});
