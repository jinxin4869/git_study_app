export interface CommandToken { text: string; redirect?: boolean }

/** Small literal tokenizer, not a shell: no expansion, pipelines, or process execution. */
export function tokenizeCommand(command: string): { tokens: CommandToken[]; error?: string } {
  const tokens: CommandToken[] = [];
  let word = '';
  let started = false;
  let quote = '';
  const flush = () => { if (started) tokens.push({ text: word }); word = ''; started = false; };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = '';
      else if (quote === '"' && char === '\\' && ['"', '\\'].includes(command[i + 1])) word += command[++i];
      else word += char;
    } else if (char === '"' || char === "'") { quote = char; started = true; }
    else if (/\s/.test(char)) flush();
    else if (char === '\\') {
      if (i + 1 === command.length) return { tokens: [], error: '末尾のバックスラッシュが不完全です。引用符や入力を確認してください。' };
      word += command[++i]; started = true;
    } else if (char === '>') {
      flush();
      if (command[i + 1] === '>') return { tokens: [], error: 'このアプリは追記（>>）に未対応です。echo "内容" > ファイルで上書きしてください。' };
      tokens.push({ text: '>', redirect: true });
    } else if ([';', '|', '&', '<'].includes(char)) return { tokens: [], error: 'このアプリは複数コマンドの連結・パイプ・入力リダイレクトに未対応です。一つずつ実行してください。' };
    else { word += char; started = true; }
  }
  if (quote) return { tokens: [], error: '引用符が閉じていません。対応する引用符を追加してから実行してください。' };
  flush();
  return { tokens };
}

/** Flags actually read by the simulator. Status/commit/switch/rm retain their detailed validators. */
const options: Record<string, { flags: string[]; values?: string[]; assignments?: string[] }> = {
  init: { flags: [] }, clone: { flags: [] }, add: { flags: ['-A', '-f', '-p', '--patch'] },
  log: { flags: ['--oneline', '--graph', '--all'], values: ['--grep'] },
  diff: { flags: ['--cached', '--staged', '--name-only'] }, show: { flags: [] }, reflog: { flags: [] }, blame: { flags: [] },
  branch: { flags: ['-a', '-m', '-d', '-D'] }, checkout: { flags: ['-b', '--detach'] },
  reset: { flags: ['--hard', '--soft', '--mixed'] }, stash: { flags: ['-u', '--include-untracked', '--index'], values: ['-m'] },
  remote: { flags: ['-v'] }, fetch: { flags: ['--prune'] },
  push: { flags: ['-u', '--set-upstream', '--force', '--force-with-lease', '--tags', '--delete'] },
  pull: { flags: ['--rebase', '--ff-only'] }, merge: { flags: ['--abort', '--no-ff', '--ff-only'] },
  rebase: { flags: ['-i', '--interactive', '--continue', '--abort', '--skip'] },
  'cherry-pick': { flags: ['--continue', '--abort', '--skip'] }, revert: { flags: ['--continue', '--abort', '--skip'] },
  restore: { flags: ['--staged', '-S', '--worktree', '-W'], values: ['-s', '--source'], assignments: ['--source='] }, mv: { flags: [] },
  config: { flags: ['--local', '--global', '--list'] }, tag: { flags: ['-a', '-d'], values: ['-m'] },
  worktree: { flags: [], values: ['-b'] }, bisect: { flags: [] }, 'sparse-checkout': { flags: ['--cone'] },
  submodule: { flags: ['--init', '--remote'] }, lfs: { flags: [] },
  'gh pr create': { flags: [], values: ['--title', '--body', '--base', '--head'] },
  'gh pr view': { flags: [] }, 'gh pr checks': { flags: [] }, 'gh pr close': { flags: [] }, 'gh pr merge': { flags: ['--merge'] },
  'simulate ci pass': { flags: [] }, 'simulate ci fail': { flags: [] },
  'simulate review approve': { flags: [], values: ['--body'] }, 'simulate review request-changes': { flags: [], values: ['--body'] },
};

export function validateCommandOptions(command: string, args: string[]): string | null {
  const syntax = Object.hasOwn(options, command) ? options[command] : undefined;
  if (!syntax) return null;
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (argument === '--') break;
    if (!argument.startsWith('-') || syntax.flags.includes(argument)) continue;
    const assignment = syntax.assignments?.find(prefix => argument.startsWith(prefix));
    if (assignment) {
      if (argument.length === assignment.length) return `git ${command}: ${assignment} の値が必要です。`;
      continue;
    }
    if (syntax.values?.includes(argument)) {
      if (args[i + 1] === undefined) return `git ${command}: ${argument} の値が必要です。`;
      i++;
      continue;
    }
    return `${command.includes(' ') ? command : `git ${command}`}: 不明またはこのアプリでは未対応のオプション: ${argument}\n対応オプション: ${[...syntax.flags, ...syntax.values ?? []].join('、') || 'なし'}。対象名がハイフンで始まる場合は、対応するコマンドで -- を使ってください。`;
  }
  return null;
}
