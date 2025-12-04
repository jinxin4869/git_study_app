import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from './git-simulator';

describe('GitEngine: cherry-pick and revert', () => {
  let engine: GitEngine;

  beforeEach(() => {
    engine = new GitEngine();
    engine.execute('git init');
  });

  describe('cherry-pick', () => {
    it('should apply changes from specified commit onto current branch', () => {
      // c1 -> c2 (main)
      //  \
      //   c3 (feature)
      //
      // Checkout main and cherry-pick c3
      
      engine.execute('touch file1.txt');
      engine.execute('git add file1.txt');
      engine.execute('git commit -m "c1"');
      
      engine.execute('git branch feature');
      
      // c2 on main
      engine.execute('touch file2.txt');
      engine.execute('git add file2.txt');
      engine.execute('git commit -m "c2"');
      
      // c3 on feature
      engine.execute('git checkout feature');
      engine.execute('touch file3.txt');
      engine.execute('git add file3.txt');
      engine.execute('git commit -m "c3"');
      
      const featureHeadId = engine.getState().branches['feature'];
      
      // Checkout main and cherry-pick c3
      engine.execute('git checkout main');
      const result = engine.execute(`git cherry-pick ${featureHeadId}`);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('c3');
      
      const state = engine.getState();
      // main should now have file1, file2, and file3
      expect(state.workingDirectory['file1.txt']).toBeDefined();
      expect(state.workingDirectory['file2.txt']).toBeDefined();
      expect(state.workingDirectory['file3.txt']).toBeDefined();
    });

    it('should abort on conflict', () => {
      engine.execute('touch file.txt');
      engine.execute('echo "base" > file.txt');
      engine.execute('git add file.txt');
      engine.execute('git commit -m "c1"');
      
      engine.execute('git branch feature');
      
      // Main modifies file
      engine.execute('echo "main" > file.txt');
      engine.execute('git add file.txt');
      engine.execute('git commit -m "c2"');
      
      // Feature modifies file differently
      engine.execute('git checkout feature');
      engine.execute('echo "feature" > file.txt');
      engine.execute('git add file.txt');
      engine.execute('git commit -m "c3"');
      
      const featureHeadId = engine.getState().branches['feature'];
      
      // Try to cherry-pick
      engine.execute('git checkout main');
      const result = engine.execute(`git cherry-pick ${featureHeadId}`);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Conflict');
    });
  });

  describe('revert', () => {
    it('should create a new commit that undoes changes', () => {
      engine.execute('touch file1.txt');
      engine.execute('git add file1.txt');
      engine.execute('git commit -m "c1"');
      
      engine.execute('touch file2.txt');
      engine.execute('git add file2.txt');
      engine.execute('git commit -m "c2"');
      
      const c2Id = engine.getState().branches['main'];
      
      // Revert c2
      const result = engine.execute(`git revert ${c2Id}`);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Revert');
      expect(result.message).toContain('c2');
      
      const state = engine.getState();
      // file2 should be gone
      expect(state.workingDirectory['file1.txt']).toBeDefined();
      expect(state.workingDirectory['file2.txt']).toBeUndefined();
    });

    it('should work with file modifications', () => {
      engine.execute('touch file.txt');
      engine.execute('echo "version1" > file.txt');
      engine.execute('git add file.txt');
      engine.execute('git commit -m "c1"');
      
      engine.execute('echo "version2" > file.txt');
      engine.execute('git add file.txt');
      engine.execute('git commit -m "c2"');
      
      const c2Id = engine.getState().branches['main'];
      
      // Revert c2 - should go back to version1
      const result = engine.execute(`git revert ${c2Id}`);
      
      expect(result.success).toBe(true);
      
      const state = engine.getState();
      expect(state.workingDirectory['file.txt']).toBe('version1');
    });
  });
});
