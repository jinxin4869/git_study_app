import { describe, expect, it } from 'vitest';
import { GitEngine } from '@/engine/git-simulator';
import { githubScenarios } from '@/engine/github-scenarios';
import type { GitState } from '@/types/git';
import { parseSession, readBackup, sessionKey, type SavedSession } from './session-store';

const cases: [string, (state: GitState) => void][] = [
  ['dangling tag', state => { state.tags = { release: { commitId: 'missing' } }; }],
  ['dangling reflog', state => { state.reflog = [{ id: 'missing', command: 'old checkout' }]; }],
  ['unregistered active worktree', state => { state.activeWorktree = '/missing'; }],
  ['worktree on a missing branch', state => { state.worktrees = { '/missing': { branch: 'missing', workingDirectory: {}, index: {} } }; }],
  ['detached flag inconsistent with HEAD', state => { state.detachedHead = true; }],
  ['empty detached HEAD', state => { state.HEAD = { type: 'commit', value: '' }; state.detachedHead = true; }],
  ['empty merge target', state => { state.pendingMerge = { targetId: '', workingDirectory: {}, index: {} }; }],
  ['empty replay target', state => { state.operation = { kind: 'rebase', original: new GitEngine(state).getState(), remaining: [''] }; }],
  ['empty bisect target', state => { state.bisect = { original: new GitEngine(state).getState(), good: '' }; }],
  ['remote parent cycle', state => { state.mockServers.origin.commits.c1.parents = ['c1']; }],
  ['remote missing parent', state => { state.mockServers.origin.commits.c1.parents = ['missing']; }],
  ['remote dangling branch', state => { state.mockServers.origin.branches.main = 'missing'; }],
  ['remote dangling tag', state => { state.mockServers.origin.tags = { release: { commitId: 'missing' } }; }],
];
describe('saved advanced reference boundaries', () => {
  it.each(cases)('rejects %s in checkpoints and backups', (_name, corrupt) => {
    const engine = new GitEngine(githubScenarios.find(item => item.id === 'github-create')!.initialState);
    const session: SavedSession = { version: 1, scenarioId: null, state: engine.getState(), output: [], history: [], hintLevel: 0, lastAttempt: null };
    corrupt(session.state);
    const raw = JSON.stringify(session);
    expect(() => parseSession(raw, new Set())).toThrow();
    expect(() => readBackup(JSON.stringify({ format: 'git-learning-backup', version: 1, records: [[sessionKey(null), raw]] }), new Set(), new Set())).toThrow();
  });
});
