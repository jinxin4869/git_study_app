import { expect } from 'vitest';
import type { Commit, GitState } from '@/types/git';

function assertHistory(commits: Record<string, Commit>, refs: string[], context: string) {
  for (const id of refs) expect(Object.hasOwn(commits, id), `${context}: ref ${id}`).toBe(true);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    expect(visiting.has(id), `${context}: parent cycle at ${id}`).toBe(false);
    if (visited.has(id)) return;
    const commit = commits[id];
    expect(commit, `${context}: missing parent ${id}`).toBeDefined();
    expect(commit.id, context).toBe(id);
    visiting.add(id);
    for (const parent of commit.parents) visit(parent);
    visiting.delete(id);
    visited.add(id);
    for (const content of Object.values(commit.tree)) expect(typeof content, context).toBe('string');
  };
  for (const id of Object.keys(commits)) visit(id);
}

export function assertGitState(state: GitState, context: string) {
  const head = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
  if (state.HEAD.type === 'branch') expect(Object.hasOwn(state.branches, state.HEAD.value), context).toBe(true);
  const refs = [...Object.values(state.branches).filter(Boolean), ...Object.values(state.remoteBranches), ...Object.values(state.tags ?? {}).map(tag => tag.commitId), ...(state.reflog ?? []).map(entry => entry.id)];
  if (head || state.HEAD.type === 'commit') refs.push(head);
  assertHistory(state.commits, refs, context);
  expect(state.detachedHead, context).toBe(state.HEAD.type === 'commit');
  expect(new Set(state.unmergedPaths).size, context).toBe(state.unmergedPaths?.length ?? 0);
  for (const [path, entry] of Object.entries(state.index)) {
    expect(entry.path, context).toBe(path);
    if (entry.status !== 'deleted') expect(typeof entry.content, context).toBe('string');
  }
  for (const content of Object.values(state.workingDirectory)) expect(typeof content, context).toBe('string');
  for (const server of Object.values(state.mockServers)) {
    assertHistory(server.commits, [...Object.values(server.branches), ...Object.values(server.tags ?? {}).map(tag => tag.commitId)], `${context}: mock remote`);
  }
  for (const tree of Object.values(state.worktrees ?? {})) {
    expect(Object.hasOwn(state.branches, tree.branch), context).toBe(true);
    for (const [path, entry] of Object.entries(tree.index)) expect(entry.path, context).toBe(path);
    for (const content of Object.values(tree.workingDirectory)) expect(typeof content, context).toBe('string');
  }
  if (state.activeWorktree) expect(state.worktrees?.[state.activeWorktree], context).toBeDefined();
  if (state.patchSession) {
    expect(state.patchSession.cursor, context).toBeGreaterThanOrEqual(0);
    expect(state.patchSession.cursor, context).toBeLessThan(state.patchSession.chunks.length);
  }
  for (const id of state.operation?.remaining ?? []) expect(state.commits[id], context).toBeDefined();
  if (state.operation?.current) expect(state.commits[state.operation.current.id], context).toBeDefined();
  for (const id of [state.bisect?.good, state.bisect?.bad, state.bisect?.found].filter((id): id is string => !!id)) expect(state.commits[id], context).toBeDefined();
}
