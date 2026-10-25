import type { GitState } from '@/types/git';

function reachable(state: GitState, tip: string): Set<string> {
  const seen = new Set<string>();
  const pending = [tip];
  while (pending.length) {
    const id = pending.pop()!;
    if (!id || seen.has(id) || !state.commits[id]) continue;
    seen.add(id);
    pending.push(...state.commits[id].parents);
  }
  return seen;
}
export function trackingStatus(state: GitState) {
  return Object.entries(state.upstreams ?? {}).map(([branch, upstream]) => {
    const local = reachable(state, state.branches[branch]);
    const remote = reachable(state, state.remoteBranches[upstream]);
    return { branch, upstream, available: !!state.remoteBranches[upstream], ahead: [...local].filter(id => !remote.has(id)).length, behind: [...remote].filter(id => !local.has(id)).length };
  });
}
