import type { GitState } from '@/types/git';
import { supportedCommands, tokenizeCommand, completionFlags } from '@/engine/command-input';

export interface CommandSuggestion { label: string; value: string }
const literal = (value: string) => /[\s"'\\]/.test(value) ? '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : value;

/** Only suggests literal simulator inputs. It never executes or expands shell syntax. */
export function commandSuggestions(input: string, state: GitState): CommandSuggestion[] {
  if (!input.trim() || tokenizeCommand(input).error) return [];
  if (state.patchSession) return [];
  const match = input.match(/\S+$/);
  const prefix = match?.[0] ?? '';
  const base = match ? input.slice(0, match.index) : input;
  if (/["'\\]/.test(prefix)) return [];
  const words = tokenizeCommand(base).tokens.map(token => token.text);
  let choices: string[] = [];
  let path = false;
  if (!words.length) choices = ['git','gh','simulate','touch','echo','rm','ls','cd','clear','help'];
  else if (words.length === 1 && words[0] === 'git') choices = [...supportedCommands,'help','--help'];
  else if (words.length === 1 && words[0] === 'gh') choices = ['pr'];
  else if (words.join(' ') === 'gh pr') choices = ['create','view','checks','ready','edit','merge','close'];
  else if (words[0] === 'gh' && words[1] === 'pr' && words.length >= 3 && prefix.startsWith('-')) choices = completionFlags(words.slice(0,3).join(' '));
  else if (words[0] === 'gh' && words[1] === 'pr' && ['edit','create'].includes(words[2]) && words.at(-1) === '--base') choices = Object.keys(state.mockServers.origin?.branches ?? {});
  else if (words.length === 1 && words[0] === 'simulate') choices = ['review','ci','rebase'];
  else if (words.join(' ') === 'simulate review') choices = ['approve','request-changes'];
  else if (words.join(' ') === 'simulate ci') choices = ['pass','fail'];
  else if (words[0] === 'git') {
    const command = words[1];
    if (prefix.startsWith('-') && !words.includes('--')) choices = completionFlags(command);
    else if (command === 'help') choices = [...supportedCommands,'help'];
    else if (['switch','checkout','merge','rebase','reset','show','cherry-pick','revert'].includes(command) || (command === 'restore' && ['-s','--source'].includes(words.at(-1)!))) {
      choices = ['HEAD',...Object.keys(state.branches),...Object.keys(state.remoteBranches),...Object.keys(state.tags ?? {}),...Object.keys(state.commits)];
    } else if (['add','restore','rm','blame','mv'].includes(command)) {
      choices = [...Object.keys(state.workingDirectory),...Object.keys(state.index)];
      path = true;
    }
  } else if (words[0] === 'rm') { choices = Object.keys(state.workingDirectory); path = true; }
  else if (words[0] === 'cd') { choices = Object.keys(state.worktrees ?? {}); path = true; }
  if (choices.includes(prefix) || prefix === '--' || (path && ['.','..'].includes(prefix))) return [];
  return [...new Set(choices)].sort().filter(value => value.startsWith(prefix) && value !== prefix && (!path || !value.startsWith('-') || words.includes('--'))).slice(0,20)
    .map(value => ({label:value,value:base + literal(value) + ' '}));
}
