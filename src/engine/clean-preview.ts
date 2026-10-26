import type { CommandResult, GitState } from '@/types/git';
import { indexTree, untrackedFiles } from './git-state';
import { isIgnored } from './gitignore';

/** Preview only. No delete operation or force option is implemented here. */
export function cleanPreview(state: GitState, args: string[]): CommandResult {
  const usage = 'このアプリは git clean -n [ -d ] / --dry-run の確認だけに対応します。パス指定・-f・-x・-X・-iには未対応です。';
  const separator = args.indexOf('--');
  if (separator >= 0 && separator !== args.length - 1) return { success: false, message: usage };
  const flags = separator < 0 ? args : args.slice(0, separator);
  const allowed = ['-n', '--dry-run', '-d', '-nd', '-dn'];
  if (flags.some(flag => !allowed.includes(flag)) || !flags.some(flag => ['-n', '--dry-run', '-nd', '-dn'].includes(flag))) return { success: false, message: usage };
  const recurse = flags.some(flag => ['-d', '-nd', '-dn'].includes(flag));
  const tracked = Object.keys(indexTree(state));
  const protectedDirectories = [...Object.keys(state.submodules ?? {}), ...Object.keys(state.workingDirectory).flatMap(path => {
    const parts = path.split('/');
    const metadata = parts.indexOf('.git');
    return metadata > 0 ? [parts.slice(0, metadata).join('/')] : [];
  })];
  const paths = Object.keys(untrackedFiles(state)).filter(path => {
    const parts = path.split('/');
    if (parts.includes('.git') || protectedDirectories.some(directory => path === directory || path.startsWith(directory + '/')) || isIgnored(state, path)) return false;
    if (recurse) return true;
    // Without -d, Git does not descend into a directory with no indexed descendants.
    return parts.slice(0, -1).every((_, index) => tracked.some(file => file.startsWith(parts.slice(0, index + 1).join('/') + '/')));
  }).sort();
  return { success: true, message: paths.length ? 'dry-run（削除は実行しません。ファイル単位で表示）\n' + paths.map(path => `Would remove ${JSON.stringify(path)}`).join('\n') : '削除候補はありません（dry-run）。' };
}
