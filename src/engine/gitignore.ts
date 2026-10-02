import { GitState } from '@/types/git';
import { indexTree } from './git-state';

export function isIgnored(state: GitState, path: string): boolean {
  if (indexTree(state)[path] !== undefined) return false;
  let ignored = false;
  for (let pattern of (state.workingDirectory['.gitignore'] ?? '').split('\n')) {
    pattern = pattern.trim();
    if (!pattern || pattern.startsWith('#')) continue;
    const negate = pattern.startsWith('!');
    if (negate) pattern = pattern.slice(1);
    const directory = pattern.endsWith('/');
    const anchored = pattern.startsWith('/') || pattern.replace(/\/$/, '').includes('/');
    pattern = pattern.replace(/^\//, '').replace(/\/$/, '');
    let expression = '';
    for (let index = 0; index < pattern.length; index++) {
      const character = pattern[index];
      if (character === '*') {
        if (pattern[index + 1] === '*') { expression += '.*'; index++; }
        else expression += '[^/]*';
      } else if (character === '?') expression += '[^/]';
      else expression += '.+^$(){}|[]\\'.includes(character) ? '\\' + character : character;
    }
    if (new RegExp((anchored ? '^' : '(?:^|/)') + expression + (directory ? '/' : '(?:$|/)')).test(path)) ignored = !negate;
  }
  return ignored;
}
