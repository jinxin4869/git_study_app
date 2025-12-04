import { describe, it, expect } from 'vitest';
import { checkGoal } from './goal-checker';
import { GitState, Scenario } from '@/types/git';

describe('checkGoal', () => {
  const mockState: GitState = {
    commits: {},
    branches: { main: 'c1' },
    HEAD: { type: 'branch', value: 'main' },
    index: {},
    workingDirectory: {},
    detachedHead: false,
    stash: [],
    remotes: {},
    remoteBranches: {},
    mockServers: {},
  };

  it('should check repo_initialized', () => {
    const scenario: Scenario = {
      id: 'test', title: 'Test', description: '', difficulty: 'beginner', category: 'basic', hints: [],
      goal: { type: 'repo_initialized' }
    };
    expect(checkGoal(mockState, scenario, 'init')).toBe(true);
    expect(checkGoal(mockState, scenario, 'status')).toBe(false);
  });

  it('should check file_exists', () => {
    const scenario: Scenario = {
      id: 'test', title: 'Test', description: '', difficulty: 'beginner', category: 'basic', hints: [],
      goal: { type: 'file_exists', params: { name: 'test.txt' } }
    };
    
    const stateWithFile = { ...mockState, workingDirectory: { 'test.txt': 'content' } };
    expect(checkGoal(stateWithFile, scenario)).toBe(true);
    expect(checkGoal(mockState, scenario)).toBe(false);
  });

  it('should check command_executed', () => {
    const scenario: Scenario = {
      id: 'test', title: 'Test', description: '', difficulty: 'beginner', category: 'basic', hints: [],
      goal: { type: 'command_executed', params: { command: 'git commit' } }
    };
    expect(checkGoal(mockState, scenario, 'git commit -m "msg"')).toBe(true);
    expect(checkGoal(mockState, scenario, 'git add .')).toBe(false);
  });
});
