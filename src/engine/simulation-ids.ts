import type { GitState } from '@/types/git';

/** A repeated random value must neither overwrite an object nor cause an endless retry. */
export function uniqueSimulationId(existing: Iterable<string>, prefix = ''): string {
  const reserved = new Set(existing);
  const base = prefix + (Math.random().toString(36).slice(2, 9) || '0');
  let id = base;
  let suffix = 0;
  while (reserved.has(id)) id = `${base}-${++suffix}`;
  return id;
}

export function newCommitId(state: GitState, prefix = ''): string {
  // Unfetched remote objects share the ID namespace when later copied by fetch/push.
  return uniqueSimulationId([
    ...Object.keys(state.commits),
    ...Object.values(state.mockServers).flatMap(server => Object.keys(server.commits)),
  ], prefix);
}
