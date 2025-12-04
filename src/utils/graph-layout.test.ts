import { describe, it, expect } from 'vitest';
import { calculateGraphLayout } from './graph-layout';
import { GitState, Commit } from '@/types/git';

// Helper to create a mock commit
const createCommit = (id: string, message: string, timestamp: number, parents: string[]): Commit => ({
  id,
  message,
  timestamp,
  parents,
  author: 'Test User',
  tree: {},
  changes: []
});

const createMockState = (commits: Record<string, Commit>, branches: Record<string, string>): GitState => ({
  commits,
  branches,
  HEAD: { type: 'branch', value: 'main' },
  index: {},
  workingDirectory: {},
  remotes: {},
  stash: [],
  detachedHead: false,
  remoteBranches: {},
  mockServers: {}
});

describe('calculateGraphLayout', () => {
  it('should layout a linear history on the main lane', () => {
    const commits = {
      'c1': createCommit('c1', 'Initial', 100, []),
      'c2': createCommit('c2', 'Second', 200, ['c1']),
    };
    const state = createMockState(commits, { 'main': 'c2' });

    const { nodes } = calculateGraphLayout(state);

    expect(nodes).toHaveLength(2);
    // c1 and c2 should be on lane 0 (y=50)
    expect(nodes.find(n => n.id === 'c1')?.y).toBe(50);
    expect(nodes.find(n => n.id === 'c2')?.y).toBe(50);
  });

  it('should assign different lanes for branches', () => {
    // c1 -> c2 (main)
    //    \-> c3 (feature)
    const commits = {
      'c1': createCommit('c1', 'Initial', 100, []),
      'c2': createCommit('c2', 'Main', 200, ['c1']),
      'c3': createCommit('c3', 'Feature', 200, ['c1']),
    };
    const state = createMockState(commits, { 
      'main': 'c2',
      'feature': 'c3'
    });

    const { nodes } = calculateGraphLayout(state);

    const c1 = nodes.find(n => n.id === 'c1');
    const c2 = nodes.find(n => n.id === 'c2');
    const c3 = nodes.find(n => n.id === 'c3');

    // c1 is shared, usually takes main's lane (0)
    expect(c1?.y).toBe(50);
    // c2 is on main, lane 0
    expect(c2?.y).toBe(50);
    // c3 is on feature, should be on a different lane (e.g., 1 -> y=100)
    expect(c3?.y).not.toBe(50);
    expect(c3?.y).toBe(100);
  });

  it('should handle merges correctly', () => {
    // c1 -> c2 -> c4 (merge)
    //    \-> c3 -/
    const commits = {
      'c1': createCommit('c1', 'Initial', 100, []),
      'c2': createCommit('c2', 'Main', 200, ['c1']),
      'c3': createCommit('c3', 'Feature', 200, ['c1']),
      'c4': createCommit('c4', 'Merge', 300, ['c2', 'c3']),
    };
    const state = createMockState(commits, { 
      'main': 'c4',
      'feature': 'c3'
    });

    const { nodes } = calculateGraphLayout(state);

    const c4 = nodes.find(n => n.id === 'c4');
    // Merge commit on main should be on lane 0
    expect(c4?.y).toBe(50);
    
    const c3 = nodes.find(n => n.id === 'c3');
    // Feature commit should be on lane 1
    expect(c3?.y).toBe(100);
  });
});
