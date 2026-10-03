import { GitState } from '@/types/git';
import { headId, cloneGitData } from './git-state';

export function resolveRevision(state: GitState, value: string): string | undefined {
  const reflog = value.match(/^HEAD@\{([0-9]+)\}$/);
  if (reflog) return state.reflog?.[Number(reflog[1])]?.id;
  const ancestry = value.match(/^(.+?)([~^])([0-9]*)$/);
  if (ancestry) {
    let id = resolveRevision(state, ancestry[1]);
    const count = ancestry[3] === '' ? 1 : Number(ancestry[3]);
    if (ancestry[2] === '^') return count === 0 ? id : id ? state.commits[id]?.parents[count - 1] : undefined;
    for (let step = 0; step < count && id; step++) id = state.commits[id]?.parents[0];
    return id;
  }
  const reference = value === 'HEAD' ? headId(state) : state.branches[value] ?? state.remoteBranches[value] ?? state.tags?.[value]?.commitId;
  if (reference && state.commits[reference]) return reference;
  if (state.commits[value]) return value;
  const matches = Object.keys(state.commits).filter(id => id.startsWith(value));
  return value && matches.length === 1 ? matches[0] : undefined;
}

export function isAncestor(commits: GitState['commits'], ancestor: string, descendant: string): boolean {
  const pending = [descendant];
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === ancestor) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(commits[id]?.parents ?? []));
  }
  return false;
}

export function copyHistory(source: GitState['commits'], destination: GitState['commits'], tip: string) {
  const pending = [tip];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const commit = source[id];
    if (!commit) continue;
    destination[id] = cloneGitData(commit);
    pending.push(...commit.parents);
  }
}
