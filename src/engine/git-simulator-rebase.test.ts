import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from './git-simulator';

describe('GitEngine: rebase', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  it('should fast-forward if current branch is ancestor of target', () => {
    // c1 (main)
    //  \
    //   c2 (feature) - HEAD
    //
    // rebase main -> fast-forward? No, rebase target is upstream.
    // git rebase <upstream>
    // If I am on feature, and I rebase main.
    // If main is ancestor of feature -> "Current branch is up to date" (or similar, if main hasn't moved)
    
    // Scenario:
    // c1 (main)
    //  \
    //   c2 (feature)
    //
    // switch to main
    // rebase feature -> fast-forward to c2
    
    engine.execute('touch file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c1"');
    
    engine.execute('git branch feature');
    engine.execute('git checkout feature');
    engine.execute('touch file2.txt');
    engine.execute('git add file2.txt');
    engine.execute('git commit -m "c2"');
    
    engine.execute('git checkout main');
    // main is at c1. feature is at c2. c1 is parent of c2.
    // rebase feature should fast-forward main to c2.
    
    const result = engine.execute('git rebase feature');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Fast-forward');
    
    const state = engine.getState();
    expect(state.branches['main']).toBe(state.branches['feature']);
  });

  it('should rebase commits onto target', () => {
    // c1 (main) -> c2
    //  \
    //   c3 (feature)
    //
    // rebase main (while on feature)
    // Result: c1 -> c2 -> c3'
    
    engine.execute('touch file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c1"');
    
    engine.execute('git branch feature');
    
    // Create c2 on main
    engine.execute('touch file2.txt');
    engine.execute('git add file2.txt');
    engine.execute('git commit -m "c2"');
    
    // Create c3 on feature
    engine.execute('git checkout feature');
    engine.execute('touch file3.txt');
    engine.execute('git add file3.txt');
    engine.execute('git commit -m "c3"');
    
    // Rebase feature onto main
    const result = engine.execute('git rebase main');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Successfully rebased');
    
    const state = engine.getState();
    const featureHeadId = state.branches['feature'];
    const featureHead = state.commits[featureHeadId];
    
    // featureHead should have parent c2 (main's tip)
    const mainHeadId = state.branches['main'];
    expect(featureHead.parents[0]).toBe(mainHeadId);
    
    // Verify content: should have file1, file2, and file3
    expect(state.workingDirectory['file1.txt']).toBeDefined();
    expect(state.workingDirectory['file2.txt']).toBeDefined();
    expect(state.workingDirectory['file3.txt']).toBeDefined();
  });

  it('should abort on conflict', () => {
    // c1 (main) -> c2 (modifies file1)
    //  \
    //   c3 (feature) (modifies file1 differently)
    
    engine.execute('touch file1.txt');
    engine.execute('echo "base" > file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c1"');
    
    engine.execute('git branch feature');
    
    // Main modifies file1
    engine.execute('echo "main change" > file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c2"');
    
    // Feature modifies file1
    engine.execute('git checkout feature');
    engine.execute('echo "feature change" > file1.txt');
    engine.execute('git add file1.txt');
    engine.execute('git commit -m "c3"');
    
    // Rebase
    const result = engine.execute('git rebase main');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Conflict detected');
  });
});
