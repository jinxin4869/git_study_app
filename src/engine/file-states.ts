import { GitState } from '@/types/git';
import { dictionary, headTree, indexTree, inSparseScope } from './git-state';
import { isIgnored } from './gitignore';
import { isUnmerged } from './conflicts';

export type ChangeKind = 'added' | 'modified' | 'deleted' | null;
export interface FileState {
  path: string;
  content: string | undefined;
  staged: ChangeKind;
  unstaged: ChangeKind;
  untracked: boolean;
  ignored: boolean;
  conflict: boolean;
}

const change = (before: string | undefined, after: string | undefined): ChangeKind =>
  before === after ? null : after === undefined ? 'deleted' : before === undefined ? 'added' : 'modified';

export function fileStates(state: GitState): FileState[] {
  const head = headTree(state);
  const index = indexTree(state);
  const working = dictionary(state.workingDirectory);
  const paths = new Set([...Object.keys(head), ...Object.keys(index), ...Object.keys(working), ...state.unmergedPaths ?? []]);
  return [...paths].filter(path => inSparseScope(state, path)).map(path => {
    const content = working[path];
    const untracked = index[path] === undefined && content !== undefined;
    const ignored = untracked && isIgnored(state, path);
    return {
      path, content,
      staged: change(head[path], index[path]),
      unstaged: index[path] === undefined ? null : change(index[path], content),
      untracked: untracked && !ignored, ignored,
      conflict: isUnmerged(state, path),
    };
  });
}

export function fileStateLabels(file: FileState): string[] {
  if (file.conflict) return ['競合'];
  const labels: string[] = [];
  if (file.staged) labels.push(`${file.staged === 'deleted' ? '削除' : file.staged === 'added' ? '追加' : '変更'}（stage済み）`);
  if (file.unstaged) labels.push(`${file.unstaged === 'deleted' ? '削除' : '変更'}（未stage）`);
  if (file.untracked) labels.push('未追跡');
  if (file.ignored) labels.push('無視対象');
  return labels;
}
