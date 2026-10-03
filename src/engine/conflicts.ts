import type { GitState } from '@/types/git';

/** A marker in ordinary text is not an unmerged index entry. */
export const isUnmerged = (state: GitState, path: string): boolean => state.unmergedPaths?.includes(path) ?? false;
export const hasUnmergedPaths = (state: GitState): boolean => !!state.unmergedPaths?.length;
export const hasConflictMarkers = (content: string): boolean => /^(<<<<<<<|=======|>>>>>>>)/m.test(content);

export function clearUnmergedPaths(state: GitState, paths?: ReadonlySet<string>) {
  const remaining = paths ? (state.unmergedPaths ?? []).filter(path => !paths.has(path)) : [];
  if (remaining.length) state.unmergedPaths = remaining;
  else delete state.unmergedPaths;
}
