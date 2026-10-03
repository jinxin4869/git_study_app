import { GitState } from '@/types/git';

// Paths and reference names may equal Object.prototype keys.
export const dictionary = <T>(entries: Record<string, T> = {}): Record<string, T> =>
  Object.assign(Object.create(null), entries);

export const cloneGitData = <T>(data: T): T => JSON.parse(JSON.stringify(data), (_key, value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) Object.setPrototypeOf(value, null);
  return value;
});

export function normalizeGitData<T>(data: T): T {
  if (data && typeof data === 'object') {
    for (const value of Object.values(data)) normalizeGitData(value);
    if (!Array.isArray(data) && Object.getPrototypeOf(data) !== null) Object.setPrototypeOf(data, null);
  }
  return data;
}

export const headId = (state: GitState) => state.HEAD.type === 'branch'
  ? state.branches[state.HEAD.value] : state.HEAD.value;

export const headTree = (state: GitState): Record<string, string> => dictionary(state.commits[headId(state)]?.tree);

// Older scenarios store only staged changes; others contain the full index.
// Overlaying entries on HEAD supports both representations without losing files.
export const indexTree = (state: GitState): Record<string, string> => {
  const tree = dictionary(headTree(state));
  for (const [path, entry] of Object.entries(state.index)) {
    if (entry.status === 'deleted') delete tree[path];
    else if (entry.content !== undefined) tree[path] = entry.content;
  }
  return tree;
};

export const sameTree = (left: Record<string, string>, right: Record<string, string>) =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(left).every(path => left[path] === right[path]);

export const untrackedFiles = (state: GitState): Record<string, string> => {
  const index = indexTree(state);
  return dictionary(Object.fromEntries(Object.entries(state.workingDirectory).filter(([path]) => index[path] === undefined)));
};

export const cleanTrackedFiles = (state: GitState) => {
  const head = headTree(state);
  const index = indexTree(state);
  return sameTree(head, index) && Object.keys(head).filter(path => inSparseScope(state, path)).every(path => head[path] === state.workingDirectory[path]);
};

export const inSparseScope = (state: GitState, path: string) => !state.sparseCheckout || !path.includes('/') || state.sparseCheckout.some(directory => path === directory || path.startsWith(directory + '/'));
export const sparseTree = (state: GitState, tree: Record<string, string>) => dictionary(Object.fromEntries(Object.entries(tree).filter(([path]) => inSparseScope(state, path))));

export const normalizeCommand = (command: string) => command.trim().replace(/^git\s+/, '').replace(/\s+/g, ' ');
