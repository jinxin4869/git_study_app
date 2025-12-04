import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from './git-simulator';

describe('GitEngine', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
  });

  it('should initialize with a default state', () => {
    const state = engine.getState();
    expect(state.HEAD.value).toBe('main');
    expect(state.branches['main']).toBe('');
  });

  it('should handle "git init"', () => {
    const result = engine.execute('git init');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Initialized empty Git repository');
  });

  it('should handle "touch" and "git add"', () => {
    engine.execute('touch test.txt');
    const result = engine.execute('git add test.txt');
    expect(result.success).toBe(true);
    
    const state = engine.getState();
    expect(state.index['test.txt']).toBeDefined();
    expect(state.index['test.txt'].status).toBe('staged');
  });

  it('should handle "git commit"', () => {
    engine.execute('touch test.txt');
    engine.execute('git add test.txt');
    const result = engine.execute('git commit -m "Initial commit"');
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Initial commit');
    
    const state = engine.getState();
    expect(Object.keys(state.commits).length).toBe(1);
    expect(state.branches['main']).not.toBe('');
  });

  it('should handle "git branch" and "git checkout"', () => {
    // Setup initial commit
    engine.execute('touch file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c1"');

    // Create branch
    const branchResult = engine.execute('git branch feature');
    expect(branchResult.success).toBe(true);
    
    const stateAfterBranch = engine.getState();
    expect(stateAfterBranch.branches['feature']).toBeDefined();

    // Checkout branch
    const checkoutResult = engine.execute('git checkout feature');
    expect(checkoutResult.success).toBe(true);
    expect(checkoutResult.message).toContain('Switched to branch');
    
    const stateAfterCheckout = engine.getState();
    expect(stateAfterCheckout.HEAD.value).toBe('feature');
  });
});
