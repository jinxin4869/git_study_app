import { CommandResult, GitState } from '@/types/git';
import { cleanTrackedFiles, headTree, indexTree, sameTree, sparseTree, untrackedFiles, dictionary, cloneGitData } from './git-state';
import { resolveRevision } from './revisions';

const virtualPath = (current: string, input: string) => {
  const parts: string[] = [];
  for (const part of (input.startsWith('/') ? input : current + '/' + input).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return '/' + parts.join('/');
};

export function advancedCommand(state: GitState, command: string, args: string[]): CommandResult | undefined {
  const success = (message: string): CommandResult => ({ success: true, message, newState: cloneGitData(state) });
  const fail = (message: string): CommandResult => ({ success: false, message });
  if (command === 'worktree' || command === 'cd') {
    const branchAt = args.indexOf('-b');
    const positional = args.filter((_, index) => branchAt < 0 || (index !== branchAt && index !== branchAt + 1));
    if (command === 'cd' ? args.length !== 1 : (args[0] === 'list' && args.length !== 1) || (args[0] === 'remove' && args.length !== 2) || (args[0] === 'add' && (positional.length < 2 || positional.length > 3 || args.filter(arg => arg === '-b').length > 1))) return fail('対応: cd <一つの仮想パス> / worktree list / remove <パス> / add [-b <新規ブランチ>] <パス> [開始位置]。余分な引数は実行しません。');
    if (state.operation || state.pendingMerge || state.bisect || state.unmergedPaths?.length) return fail('現在の履歴操作や競合を完了・中断してから作業場所を変更してください。');
    if (state.HEAD.type !== 'branch') return fail('ブランチ上でworktree操作を始めてください。');
    const active = state.activeWorktree ?? '/workspace/project';
    state.worktrees ??= dictionary();
    state.worktrees[active] = { branch: state.HEAD.value, workingDirectory: { ...state.workingDirectory }, index: cloneGitData(state.index) };
    state.activeWorktree = active;
    if (command === 'cd') {
      const target = virtualPath(active, args[0] ?? '');
      const worktree = state.worktrees[target];
      if (!worktree) return fail('登録済みの仮想worktreeのパスを指定してください。');
      state.activeWorktree = target;
      state.HEAD = { type: 'branch', value: worktree.branch };
      state.workingDirectory = { ...worktree.workingDirectory };
      state.index = cloneGitData(worktree.index);
      return success(`仮想作業場所: ${target}`);
    }
    if (args[0] === 'list') return success(Object.entries(state.worktrees).map(([path, tree]) => `${path} ${state.branches[tree.branch]} [${tree.branch}]`).join('\n'));
    if (args[0] === 'remove') {
      const path = virtualPath(active, args[1] ?? '');
      const tree = state.worktrees[path];
      if (!tree || path === active) return fail('現在の作業場所以外のworktreeを指定してください。');
      if (Object.values(tree.index).some(file => file.status !== 'unmodified') || !sameTree(tree.workingDirectory, state.commits[state.branches[tree.branch]]?.tree ?? {})) return fail('worktreeに未保存の変更があります。');
      delete state.worktrees[path];
      return success('仮想worktreeを削除しました。ブランチは残ります。');
    }
    if (args[0] !== 'add') return fail('worktree add/list/remove に対応しています。');
    const at = args.indexOf('-b');
    const values = args.filter((_, index) => index !== at && index !== at + 1 || at === -1);
    const path = virtualPath(active, values[1] ?? '');
    const name = at >= 0 ? args[at + 1] : values[2] ?? path.split('/').at(-1)!;
    if (!values[1] || state.worktrees[path] || Object.values(state.worktrees).some(tree => tree.branch === name)) return fail('新しいパスと、他のworktreeで使っていないブランチを指定してください。');
    const start = at >= 0 ? values[2] ?? 'HEAD' : state.branches[name] ? name : 'HEAD';
    const id = resolveRevision(state, start);
    if (!id || (at >= 0 && state.branches[name])) return fail('開始位置か新規ブランチ名が無効です。');
    state.branches[name] ??= id;
    state.worktrees[path] = { branch: name, workingDirectory: { ...state.commits[state.branches[name]].tree }, index: dictionary() };
    return success(`仮想worktree ${path} を作成しました。cd ${path} で移動できます。`);
  }
  if (command === 'bisect') {
    if ((['start', 'reset'].includes(args[0]) && args.length !== 1) || (['good', 'bad'].includes(args[0]) && ![1, 2].includes(args.length))) return fail('対応: bisect start / reset / good|bad [一つのコミット]。追加引数は実行しません。');
    if (args[0] === 'start') {
      if (state.bisect || state.operation || state.pendingMerge || !cleanTrackedFiles(state)) return fail('変更を保存し、進行中の操作を終了してください。');
      state.bisect = { original: cloneGitData(state) };
      return success('bisectを開始しました。badとgoodのコミットを指定してください。');
    }
    const bisect = state.bisect;
    if (!bisect) return fail('先にgit bisect startを実行してください。');
    if (args[0] === 'reset') {
      if (!cleanTrackedFiles(state)) return fail('変更を保存してからbisect resetしてください。');
      const untracked = untrackedFiles(state);
      if (Object.keys(untracked).some(path => headTree(bisect.original)[path] !== undefined)) return fail('Untracked files would be overwritten.');
      const found = bisect.found;
      Object.assign(state, cloneGitData(bisect.original), { lastBisectFound: found });
      delete state.bisect;
      state.workingDirectory = { ...sparseTree(state, headTree(state)), ...untracked };
      return success('bisect前の作業場所に戻りました。');
    }
    if (!['good', 'bad'].includes(args[0])) return fail('bisect start/good/bad/reset に対応しています。');
    const id = resolveRevision(state, args[1] ?? 'HEAD');
    if (!id) return fail('コミットが見つかりません。');
    if (args[0] === 'good') bisect.good = id;
    else bisect.bad = id;
    if (!bisect.good || !bisect.bad) return success('判定を記録しました。もう一方のgood/badを指定してください。');
    const chain: string[] = [];
    let cursor: string | undefined = bisect.bad;
    while (cursor && cursor !== bisect.good && !chain.includes(cursor)) {
      chain.unshift(cursor);
      cursor = state.commits[cursor]?.parents[0];
    }
    if (cursor !== bisect.good || !chain.length) return fail('この模擬演習ではgoodからbadへ続く一本の履歴を指定してください。');
    const candidate = chain.length === 1 ? chain[0] : chain[Math.floor((chain.length - 1) / 2)];
    if (!cleanTrackedFiles(state)) return fail('候補へ移動する前に変更を保存してください。');
    const untracked = untrackedFiles(state);
    if (Object.keys(untracked).some(path => state.commits[candidate].tree[path] !== undefined)) return fail('Untracked files would be overwritten.');
    if (chain.length === 1) bisect.found = candidate;
    state.HEAD = { type: 'commit', value: candidate };
    state.detachedHead = true;
    state.index = dictionary();
    state.workingDirectory = { ...sparseTree(state, state.commits[candidate].tree), ...untracked };
    return success(bisect.found ? `${candidate} is the first bad commit` : `候補 ${candidate} を検証してgoodまたはbadを指定してください。`);
  }
  if (command === 'sparse-checkout') {
    if ((['list', 'disable'].includes(args[0]) && args.length !== 1) || (args[0] === 'init' && (args.length > 2 || (args.length === 2 && args[1] !== '--cone'))) || (args[0] === 'set' && args.slice(1).some(arg => arg.startsWith('-')))) return fail('対応: sparse-checkout init [--cone] / list / disable / set <ディレクトリ...>。未対応の追加引数は実行しません。');
    if (!cleanTrackedFiles(state)) return fail('変更を保存してから対象範囲を変更してください。');
    if (args[0] === 'list') return success(state.sparseCheckout?.join('\n') ?? 'sparse-checkoutは無効です。');
    const untracked = untrackedFiles(state);
    if (args[0] === 'disable') { delete state.sparseCheckout; state.workingDirectory = { ...headTree(state), ...untracked }; return success('全ファイルを展開しました。'); }
    if (args[0] === 'init') { state.sparseCheckout = []; state.workingDirectory = { ...sparseTree(state, headTree(state)), ...untracked }; return success('cone形式のsparse-checkoutを開始しました。'); }
    if (args[0] !== 'set' || args.length < 2) return fail('sparse-checkout init/set/list/disable に対応しています。');
    state.sparseCheckout = args.slice(1).map(path => path.replace(/\/$/, ''));
    state.workingDirectory = { ...sparseTree(state, headTree(state)), ...untracked };
    return success('指定したディレクトリとルートのファイルを展開しました。');
  }
  if (command === 'submodule') {
    if ((args[0] === 'status' && args.length !== 1) || (args[0] === 'add' && args.length !== 3)) return fail('対応: submodule status / add <模擬URL> <パス> / update [--init|--remote] [パス...]。追加引数は実行しません。');
    state.submodules ??= dictionary();
    if (args[0] === 'status') return success(Object.entries(state.submodules).map(([path, module]) => `${module.initialized ? indexTree(state)[path] === `Subproject commit ${module.commitId}` ? ' ' : '+' : '-'}${module.commitId} ${path}`).join('\n'));
    if (args[0] === 'add') {
      const [, url, path] = args;
      const remote = Object.keys(state.remotes).find(name => state.remotes[name] === url);
      const id = remote ? state.mockServers[remote]?.branches.main : undefined;
      if (!url || !path || !id || state.submodules[path] || state.workingDirectory[path] !== undefined) return fail('登録済みの仮想URLと新しいパスを指定してください。');
      state.submodules[path] = { url, commitId: id, initialized: true };
      state.workingDirectory['.gitmodules'] = (state.workingDirectory['.gitmodules'] ?? '') + `[submodule "${path}"]\n\tpath = ${path}\n\turl = ${url}\n`;
      state.workingDirectory[path] = `Subproject commit ${id}`;
      state.index['.gitmodules'] = { path: '.gitmodules', status: 'staged', content: state.workingDirectory['.gitmodules'] };
      state.index[path] = { path, status: 'staged', content: state.workingDirectory[path] };
      return success('仮想submoduleを追加しました。親リポジトリへコミットしてください。');
    }
    if (args[0] !== 'update') return fail('submodule add/status/update に対応しています。');
    const paths = args.slice(1).filter(arg => !arg.startsWith('-'));
    if (paths.some(path => !Object.hasOwn(state.submodules!, path))) return fail('登録済みのsubmoduleパスを指定してください。');
    for (const [path, module] of Object.entries(state.submodules)) {
      if (paths.length && !paths.includes(path)) continue;
      const remote = Object.keys(state.remotes).find(name => state.remotes[name] === module.url);
      const id = args.includes('--remote') ? remote ? state.mockServers[remote]?.branches.main : undefined : indexTree(state)[path]?.replace(/^Subproject commit /, '');
      if (!id) return fail('submoduleの取得先か記録済みコミットがありません。');
      module.commitId = id;
      module.initialized = true;
      state.workingDirectory[path] = `Subproject commit ${id}`;
    }
    return success('仮想submoduleを取得しました。--remoteの更新は親リポジトリでadd・commitして記録してください。');
  }
  if (command === 'lfs') {
    if ((args[0] === 'install' && args.length !== 1) || (args[0] === 'track' && ![1, 2].includes(args.length))) return fail('この模擬LFSは install / track [一つのパターン] に対応しています。追加引数は実行しません。');
    state.lfs ??= { installed: false, patterns: [] };
    if (args[0] === 'install') { state.lfs.installed = true; return success('模擬LFSの設定を有効にしました。実際のGit LFSのインストールや転送は行いません。'); }
    if (!state.lfs.installed) return fail('先にgit lfs installを実行してください。');
    if (args[0] === 'track') {
      if (!args[1]) return success(state.lfs.patterns.join('\n'));
      if (!state.lfs.patterns.includes(args[1])) state.lfs.patterns.push(args[1]);
      const rule = `${args[1]} filter=lfs diff=lfs merge=lfs -text`;
      const existing = state.workingDirectory['.gitattributes'] ?? '';
      if (!existing.split('\n').includes(rule)) state.workingDirectory['.gitattributes'] = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + rule + '\n';
      return success('LFS対象の属性を設定しました。.gitattributesをadd・commitして共有してください。この模擬環境ではバイナリをポインタへ変換しません。');
    }
    return fail('模擬LFSはinstall/trackの設定演習に対応しています。');
  }
  return undefined;
}
