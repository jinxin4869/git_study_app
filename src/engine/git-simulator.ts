import { GitState, CommandResult, Commit, FileChange } from '@/types/git';
import { generateDiff } from '@/utils/diff-utils';
import { headTree, indexTree, sameTree, cleanTrackedFiles, inSparseScope, sparseTree, untrackedFiles, dictionary, cloneGitData, normalizeGitData } from './git-state';
import { githubCommand } from './github-simulator';
import { copyHistory, isAncestor, resolveRevision } from './revisions';
import { advancedCommand } from './advanced-simulator';
import { isIgnored } from './gitignore';
import { diffLines } from 'diff';
import { fileStates } from './file-states';
import { tokenizeCommand, validateCommandOptions } from './command-input';
import { isUnmerged, hasUnmergedPaths, clearUnmergedPaths } from './conflicts';

export interface ConflictResolutionSession {
  path: string;
  content: string;
  revision: number;
}

/**
 * GitEngine class simulates the core behavior of Git.
 * It manages the repository state including commits, branches, index, working directory, and remotes.
 */
export class GitEngine {
  private state: GitState;
  private revision = 0;

  constructor(initialState?: GitState) {
    this.state = cloneGitData(initialState ?? this.createInitialState());
  }

  /**
   * Creates the initial empty state of a git repository.
   */
  private createInitialState(): GitState {
    return {
      commits: dictionary(),
      branches: dictionary({ main: '' }), // 'main' ブランチは存在するが、初期状態では何も指していない
      HEAD: { type: 'branch', value: 'main' },
      index: dictionary(),
      workingDirectory: dictionary(),
      detachedHead: false,
      stash: [],
      remotes: dictionary(),
      remoteBranches: dictionary(),
      mockServers: dictionary(),
    };
  }

  /**
   * Returns a deep copy of the current state.
   */
  public getState(): GitState {
    return cloneGitData(this.state);
  }

  /**
   * Loads a new state into the engine.
   */
  public loadState(newState: GitState) {
    this.state = cloneGitData(newState);
    this.revision++;
  }

  public openConflictResolution(path: string): ConflictResolutionSession | null {
    const content = this.state.workingDirectory[path];
    return isUnmerged(this.state, path) && content?.includes('<<<<<<<') ? { path, content, revision: this.revision } : null;
  }

  public isConflictResolutionCurrent(session: ConflictResolutionSession): boolean {
    return session.revision === this.revision &&
      isUnmerged(this.state, session.path) && this.state.workingDirectory[session.path] === session.content && session.content.includes('<<<<<<<');
  }

  public resolveConflict(session: ConflictResolutionSession, content: string): CommandResult {
    if (!this.isConflictResolutionCurrent(session)) {
      return { success: false, message: '競合の状態が変わりました。ファイルを開き直して確認してください。' };
    }
    this.touch(session.path, content);
    return { success: true, message: `Resolved conflict in ${session.path}`, newState: this.getState() };
  }

  public setRebaseTodo(todo: string): CommandResult {
    if (this.state.operation?.awaiting !== 'todo') return { success: false, message: 'No rebase todo editor is open.' };
    if (this.state.operation.todo !== todo) this.revision++;
    this.state.operation.todo = todo;
    return { success: true, message: '', newState: this.getState() };
  }

  /**
   * Executes a git command.
   * @param command The full command string (e.g., "git commit -m 'msg'")
   */
  public execute(command: string): CommandResult {
    const previousState = this.getState();
    const previousRevision = this.revision;
    try {
      const previousId = this.resolveHeadCommitId();
      const previousHead = { ...this.state.HEAD };
      const result = this.executeCommand(command);
      if (!result.success && !result.newState) this.state = previousState;
      const currentId = this.resolveHeadCommitId();
      if ((result.success || result.newState) && currentId && (currentId !== previousId || this.state.HEAD.value !== previousHead.value || this.state.HEAD.type !== previousHead.type)) {
        if (!this.state.reflog) this.state.reflog = previousId ? [{ id: previousId, command: 'initial state' }] : [];
        this.state.reflog.unshift({ id: currentId, command });
      }
      // Normalize dictionaries introduced by commands before exposing the next snapshot.
      this.state = normalizeGitData(this.state);
      if (result.newState) {
        const untracked = untrackedFiles(this.state);
        this.state.workingDirectory = dictionary({ ...sparseTree(this.state, this.state.workingDirectory), ...untracked });
        result.newState = this.getState();
      }
      // Read-only and rejected commands retain decisions; any state change invalidates old drafts.
      this.revision = previousRevision + (JSON.stringify(previousState) !== JSON.stringify(this.state) ? 1 : 0);
      return result;
    } catch {
      this.state = previousState;
      this.revision = previousRevision;
      return { success: false, message: '予期しないエラーが起きたため、このコマンドの直前へ戻しました。入力を確認するか演習をリセットしてください。' };
    }
  }

  private executeCommand(command: string): CommandResult {
    const parsed = tokenizeCommand(command);
    if (parsed.error) return { success: false, message: parsed.error };
    const parts = parsed.tokens.map(token => token.text);
    if (parts[0] !== 'echo' && parsed.tokens.some(token => token.redirect)) return { success: false, message: 'このアプリの出力リダイレクトはecho "内容" > ファイルだけに対応しています。' };
    if (this.state.patchSession) return parts.length === 1 && ['y', 'n', 'q'].includes(parts[0]) ? this.answerPatch(parts[0]) : { success: false, message: 'ハンクをy/nで選ぶか、qで終了してください。' };
    if (parts[0] === 'cd') return advancedCommand(this.state, 'cd', parts.slice(1))!;
    if (parts[0] === 'simulate' && parts[1] === 'rebase' && parts[2] === 'todo') return this.setRebaseTodo(parts.slice(3).join(' ').split(';').join('\n'));
    if (parts[0] === 'gh' || parts[0] === 'simulate') {
      const error = validateCommandOptions(parts.slice(0, 3).join(' '), parts.slice(3));
      if (error) return { success: false, message: error };
      return githubCommand(this.state, parts.slice(1), parts[0] === 'simulate');
    }
    if (parts[0] === 'ls') return parts.length === 1 ? { success: true, message: Object.keys(this.state.workingDirectory).sort().join('\n') } : { success: false, message: 'このアプリは引数なしのlsに対応しています。' };
    
    // 非Gitコマンドの処理
    if (parts[0] === 'touch') {
      const filename = parts[1];
      if (!filename || parts.length !== 2) return { success: false, message: 'usage: touch <filename>（このアプリでは一つのファイルを指定）' };
      if (!inSparseScope(this.state, filename)) return { success: false, message: '先にsparse-checkoutの対象を広げてください。' };
      // touchのシミュレーション: 存在しない場合は作成、存在する場合はタイムスタンプ更新（内容は変更なし）
      if (this.state.workingDirectory[filename] === undefined) {
        this.touch(filename, '');
        return { success: true, message: '', newState: this.state };
      }
      return { success: true, message: '', newState: this.state };
    }

    if (parts[0] === 'echo') {
      // echo "content" > filename の簡易パース
      const redirectIndex = parsed.tokens.findIndex(token => token.redirect);
      if (redirectIndex < 1 || redirectIndex !== parts.length - 2 || parsed.tokens.filter(token => token.redirect).length !== 1) {
        return { success: false, message: 'usage: echo "content" > <filename>' };
      }
      
      const filename = parts[redirectIndex + 1];
      if (!inSparseScope(this.state, filename)) return { success: false, message: '先にsparse-checkoutの対象を広げてください。' };
      // echo と > の間の部分を結合
      const content = parts.slice(1, redirectIndex).join(' ');
      
      this.touch(filename, content);
      return { success: true, message: '', newState: this.state };
    }

    if (parts[0] === 'rm') {
      const path = parts[1];
      if (!path || parts.length !== 2 || this.state.workingDirectory[path] === undefined) return { success: false, message: 'rm: 一つの存在するファイルを指定してください。' };
      delete this.state.workingDirectory[path];
      return { success: true, message: '', newState: this.getState() };
    }

    if (parts[0] !== 'git') {
      return { success: false, message: "Command must start with 'git', 'touch', or 'echo'" };
    }

    const cmd = parts[1];
    const args = parts.slice(2);
    const optionError = validateCommandOptions(cmd, args);
    if (optionError) return { success: false, message: optionError };
    if (cmd === 'init' && args.length) return { success: false, message: 'このアプリは引数なしのgit initに対応しています。' };
    const advanced = advancedCommand(this.state, cmd, args);
    if (advanced) return advanced;

    switch (cmd) {
      case 'init':
        return this.init();
      case 'clone': {
        if (args.length !== 1) return { success: false, message: 'このアプリでは git clone <模擬URL> を指定してください。保存先や追加引数には未対応です。' };
        const name = Object.keys(this.state.remotes).find(remote => this.state.remotes[remote] === args[0]);
        const server = name ? this.state.mockServers[name] : undefined;
        if (!server?.branches.main) return { success: false, message: '模擬環境に登録されたURLを指定してください。' };
        const servers = cloneGitData(this.state.mockServers);
        this.state = this.createInitialState();
        this.state.remotes.origin = args[0];
        this.state.mockServers = dictionary({ ...servers, origin: cloneGitData(server) });
        this.fetch(['origin']);
        this.state.branches.main = server.branches.main;
        this.state.workingDirectory = { ...this.state.commits[server.branches.main].tree };
        this.state.upstreams = { main: 'origin/main' };
        return { success: true, message: 'Cloned mock repository.', newState: this.getState() };
      }
      case 'add':
        return this.add(args);
      case 'commit':
        return this.commit(args);
      case 'status':
        return this.status(args);
      case 'blame':
        return this.blame(args);
      case 'log':
        return this.log(args);
      case 'show':
        return this.show(args);
      case 'reflog':
        if (args.length) return { success: false, message: 'このアプリは引数なしのgit reflogに対応しています。' };
        return { success: true, message: (this.state.reflog ?? []).map((entry, i) => `${entry.id} HEAD@{${i}}: ${entry.command}`).join('\n') };
      case 'tag':
        return this.tag(args);
      case 'config':
        return this.configure(args);
      case 'reset':
        return this.reset(args);
      case 'stash':
        return this.stash(args);
      case 'remote':
        return this.remote(args);
      case 'push':
        return this.push(args);
      case 'fetch':
        return this.fetch(args);
      case 'pull':
        return this.pull(args);
      case 'merge':
        return this.merge(args);
      case 'diff':
        return this.diff(args);
      case 'rebase':
        return this.rebase(args);
      case 'cherry-pick':
        return this.cherryPick(args);
      case 'revert':
        return this.revert(args);

      case 'branch':
        return this.branch(args);
      case 'checkout':
        return this.checkout(args);
      case 'switch':
        return this.switchBranch(args);
      case 'restore':
        return this.restore(args);
      case 'rm':
      case 'mv':
        return this.fileOperation(cmd, args);
      default:
        return { success: false, message: `git: '${cmd}' is not a git command.` };
    }
  }

  /**
   * Implements `git reset`.
   * Supports --soft, --mixed (default), and --hard modes.
   */
  private reset(args: string[]): CommandResult {
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed';
    let target = 'HEAD';

    const modes = args.filter(arg => ['--soft', '--mixed', '--hard'].includes(arg));
    const targets = args.filter(arg => !['--soft', '--mixed', '--hard'].includes(arg));
    if (modes.length > 1 || targets.length > 1 || targets.some(arg => arg.startsWith('-'))) return { success: false, message: 'このアプリでは git reset [--soft|--mixed|--hard] [一つのコミット] を使ってください。ファイルのstage解除には git restore --staged <ファイル> を使います。' };
    mode = modes[0] === '--soft' ? 'soft' : modes[0] === '--hard' ? 'hard' : 'mixed';
    target = targets[0] ?? 'HEAD';
    if (mode === 'soft' && hasUnmergedPaths(this.state)) return { success: false, message: '競合中のsoft resetはできません。競合を解消するか、操作案内の中断方法を使ってください。' };

    const commitId = resolveRevision(this.state, target);
    if (!commitId) return { success: false, message: `Commit ${target} not found` };

    const targetCommit = this.state.commits[commitId];
    if (!targetCommit) return { success: false, message: `Commit ${commitId} not found` };

    const originalIndex = indexTree(this.state);
    // HEADをターゲットコミットに移動
    if (this.state.HEAD.type === 'branch') {
      this.state.branches[this.state.HEAD.value] = commitId;
    } else {
      this.state.HEAD.value = commitId;
    }

    // モードに基づいてインデックスとワーキングディレクトリを更新
    if (mode === 'soft') {
      this.state.index = dictionary();
      for (const path of new Set([...Object.keys(targetCommit.tree), ...Object.keys(originalIndex)])) {
        this.state.index[path] = originalIndex[path] === undefined
          ? { path, status: 'deleted' }
          : { path, status: originalIndex[path] === targetCommit.tree[path] ? 'unmodified' : 'staged', content: originalIndex[path] };
      }
      // Soft reset: HEADのみ移動、インデックスとWDは変更なし。
      // 新しいHEADとインデックスの間の変更は「ステージ済み」となる。
    } else if (mode === 'mixed') {
      // Mixed reset: HEAD移動、インデックスはHEADに合わせてリセット、WDは変更なし。
      // インデックス（現在はHEAD）とWDの間の変更は「未ステージ」となる。
      this.state.index = dictionary(); // 簡易化: インデックスをクリアすることで、このモデルでは実質的にHEADと一致させる
    } else if (mode === 'hard') {
      // Hard reset: HEAD移動、インデックスとWDもHEADに合わせてリセット。
      this.state.index = dictionary();
      const untracked = Object.fromEntries(Object.entries(this.state.workingDirectory).filter(([path]) => originalIndex[path] === undefined && targetCommit.tree[path] === undefined && !isUnmerged(this.state, path)));
      this.state.workingDirectory = { ...targetCommit.tree, ...untracked };
    }
    if (mode !== 'soft') {
      clearUnmergedPaths(this.state);
      delete this.state.pendingMerge;
    }

    return { success: true, message: `HEAD is now at ${commitId.substring(0,7)} ${targetCommit.message}`, newState: this.state };
  }

  /**
   * Implements `git stash`.
   * Supports push, pop, apply, list.
   */
  private stash(args: string[]): CommandResult {
    const explicitAction = args[0] && !args[0].startsWith('-');
    const action = explicitAction ? args[0] : 'push';
    const rest = explicitAction ? args.slice(1) : args;
    const flags = new Set<string>();
    const targets: string[] = [];
    let message: string | undefined;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === '-m') message = rest[++i];
      else if (['-u', '--include-untracked', '--index'].includes(arg)) flags.add(arg);
      else targets.push(arg);
    }
    const usage = 'このアプリのstash: [push [-u] [-m "説明"]] / save [説明] / list / show|drop [stash@{番号}] / apply|pop [--index] [stash@{番号}]。未対応のパスや余分な引数は実行しません。';
    if (!['push', 'save', 'list', 'show', 'drop', 'apply', 'pop'].includes(action)) return { success: false, message: usage };
    if (action === 'push' || action === 'save') {
      if ((action === 'push' && targets.length) || flags.has('--index') || targets.some(arg => arg.startsWith('-'))) return { success: false, message: usage };
      if (hasUnmergedPaths(this.state)) return { success: false, message: 'stashする前に競合を解消してstageしてください。' };
    } else if ((action === 'list' && targets.length) || targets.length > 1 || message !== undefined || [...flags].some(flag => flag !== '--index' || !['apply', 'pop'].includes(action))) return { success: false, message: usage };
    const head = headTree(this.state);
    if (action === 'push' || action === 'save') {
      if (this.state.pendingMerge) return { success: false, message: 'Resolve or abort the merge first.' };
      const includeUntracked = flags.has('-u') || flags.has('--include-untracked');
      const effectiveIndex = indexTree(this.state);
      const tracked = new Set([...Object.keys(head), ...Object.keys(effectiveIndex)]);
      const hidden = Object.fromEntries(Object.entries(head).filter(([path]) => !inSparseScope(this.state, path)));
      const shouldSave = (path: string) => tracked.has(path) || (includeUntracked && !isIgnored(this.state, path));
      const saved = { ...hidden, ...Object.fromEntries(Object.entries(this.state.workingDirectory).filter(([path]) => shouldSave(path))) };
      const changed = !sameTree(head, effectiveIndex) || !sameTree(head, saved);
      if (!changed) return { success: false, message: 'No local changes to save.' };
      message ??= action === 'save' ? targets.join(' ') : `WIP on ${this.state.HEAD.value}`;
      this.state.stash.push({ id: Math.random().toString(36).slice(2, 9), message: message || 'WIP', baseTree: { ...head }, index: cloneGitData(this.state.index), workingDirectory: saved, timestamp: Date.now() });
      const preserved = Object.fromEntries(Object.entries(this.state.workingDirectory).filter(([path]) => !shouldSave(path)));
      this.state.index = dictionary();
      this.state.workingDirectory = { ...head, ...preserved };
      return { success: true, message: 'Saved changes.', newState: this.getState() };
    }
    if (action === 'list') return { success: true, message: [...this.state.stash].reverse().map((entry, i) => `stash@{${i}}: ${entry.message}`).join('\n') || 'stash list is empty' };
    const rawReference = targets[0] ?? 'stash@{0}';
    const reference = /^\d+$/.test(rawReference) ? `stash@{${rawReference}}` : rawReference;
    const match = reference.match(/^stash@\{([0-9]+)\}$/);
    const index = match ? this.state.stash.length - 1 - Number(match[1]) : -1;
    const entry = this.state.stash[index];
    if (!entry) return { success: false, message: 'Stash entry not found.' };
    if (action === 'drop') {
      this.state.stash.splice(index, 1);
      return { success: true, message: 'Dropped stash.', newState: this.getState() };
    }
    const original = entry.baseTree ?? head;
    if (action === 'show') {
      let message = '';
      for (const path of new Set([...Object.keys(original), ...Object.keys(entry.workingDirectory)])) if (original[path] !== entry.workingDirectory[path]) message += generateDiff(path, original[path] ?? '', entry.workingDirectory[path] ?? '');
      return { success: true, message };
    }
    if (action !== 'pop' && action !== 'apply') return { success: false, message: 'Supported: stash push/list/show/apply/pop/drop' };
    if (!cleanTrackedFiles(this.state)) return { success: false, message: 'Commit or stash current changes before applying.' };
    const snapshot = (tree: Record<string, string>): Commit => ({ id: 'stash-snapshot', tree: dictionary(tree), parents: [], message: 'stash', author: 'User', changes: [], timestamp: 0 });
    const hidden = Object.fromEntries(Object.entries(head).filter(([path]) => !inSparseScope(this.state, path)));
    const merged = this.performThreeWayMerge(snapshot(original), snapshot({ ...hidden, ...this.state.workingDirectory }), snapshot(entry.workingDirectory));
    this.state.workingDirectory = merged.tree;
    if (merged.hasConflict) {
      this.state.unmergedPaths = merged.conflictedPaths;
      return { success: false, message: 'Stash conflict: resolve the files; the stash has been kept.', newState: this.getState() };
    }
    this.state.index = flags.has('--index') ? cloneGitData(Object.fromEntries(Object.entries(entry.index).filter(([path, file]) => file.status === 'deleted' || file.content !== original[path]))) : dictionary();
    if (action === 'pop') this.state.stash.splice(index, 1);
    return { success: true, message: 'Applied stash changes.', newState: this.getState() };
  }

  private remote(args: string[]): CommandResult {
    const [action, name, value] = args;
    if ((action === '-v' && args.length !== 1) || (['add', 'set-url'].includes(action) && args.length !== 3) || (['remove', 'rm'].includes(action) && args.length !== 2)) return { success: false, message: '対応: git remote [-v] / add|set-url <名前> <URL> / remove <名前>。余分な引数は実行しません。' };
    if (!action || action === '-v') return { success: true, message: Object.entries(this.state.remotes).map(([name, url]) => `${name}\t${url} (fetch)\n${name}\t${url} (push)`).join('\n') };
    if (action === 'add') {
      if (!name || !value || this.state.remotes[name]) return { success: false, message: 'Specify a new remote name and URL.' };
      this.state.remotes[name] = value;
      this.state.mockServers[name] ??= { branches: dictionary(), commits: dictionary() };
    } else if (action === 'set-url') {
      if (!this.state.remotes[name] || !value) return { success: false, message: 'Remote not found or URL missing.' };
      this.state.remotes[name] = value;
    } else if (action === 'remove' || action === 'rm') {
      if (!this.state.remotes[name]) return { success: false, message: 'Remote not found.' };
      delete this.state.remotes[name];
      for (const branch of Object.keys(this.state.remoteBranches)) if (branch.startsWith(name + '/')) delete this.state.remoteBranches[branch];
      for (const branch of Object.keys(this.state.upstreams ?? {})) if (this.state.upstreams![branch].startsWith(name + '/')) delete this.state.upstreams![branch];
    } else return { success: false, message: 'Supported: remote add/remove/set-url/-v' };
    return { success: true, message: '', newState: this.getState() };
  }

  private push(args: string[]): CommandResult {
    if (args.filter(arg => !arg.startsWith('-')).length > 2 || args.includes('--') || (args.includes('--delete') && args.includes('--tags'))) return { success: false, message: 'このアプリは git push [対応オプション] [接続先] [一つのブランチまたはタグ] に対応しています。複数の対象や削除と全タグ送信の併用は実行しません。' };
    const setUpstream = args.includes('-u') || args.includes('--set-upstream');
    const force = args.includes('--force');
    const lease = args.includes('--force-with-lease');
    const positional = args.filter(arg => !arg.startsWith('-'));
    const current = this.state.HEAD.type === 'branch' ? this.state.HEAD.value : undefined;
    const tracking = current ? this.state.upstreams?.[current]?.split('/') : undefined;
    const remoteName = positional[0] ?? tracking?.[0] ?? 'origin';
    const branch = positional[1] ?? (tracking ? tracking.slice(1).join('/') : current);
    const server = this.state.mockServers[remoteName];
    if (!server || !this.state.remotes[remoteName]) return { success: false, message: `Unknown remote: ${remoteName}` };
    if (args.includes('--tags') || (branch && this.state.tags?.[branch] && !this.state.branches[branch])) {
      const tags = args.includes('--tags') ? Object.entries(this.state.tags ?? {}) : [[branch!, this.state.tags![branch!]]] as [string, { commitId: string; message?: string }][];
      server.tags ??= dictionary();
      if (tags.some(([name, tag]) => server.tags![name] && server.tags![name].commitId !== tag.commitId && !force)) return { success: false, message: 'Remote tag already exists.' };
      for (const [name, tag] of tags) { copyHistory(this.state.commits, server.commits, tag.commitId); server.tags[name] = { ...tag }; }
      return { success: true, message: 'Pushed tags to mock remote.', newState: this.getState() };
    }
    if (args.includes('--delete')) {
      if (!branch || !server.branches[branch] || (branch === 'main' && this.state.github)) return { success: false, message: 'Cannot delete this remote branch.' };
      delete server.branches[branch];
      delete this.state.remoteBranches[`${remoteName}/${branch}`];
      return { success: true, message: 'Deleted mock remote branch.', newState: this.getState() };
    }
    if (!branch || !this.state.branches[branch]) return { success: false, message: 'Specify a valid local branch.' };
    if (this.state.github && branch === 'main' && (this.state.github.requireReview || this.state.github.requireCI)) return { success: false, message: 'Protected branch: use a reviewed PR with passing CI.' };
    const localId = this.state.branches[branch];
    const remoteId = server.branches[branch];
    if (lease && remoteId !== this.state.remoteBranches[`${remoteName}/${branch}`]) return { success: false, message: 'Rejected: stale info (force-with-lease). Fetch and inspect teammate changes.' };
    const commits = { ...server.commits, ...this.state.commits };
    if (remoteId && !isAncestor(commits, remoteId, localId) && !force && !lease) return { success: false, message: 'Rejected (non-fast-forward). Fetch and integrate remote changes first.' };
    copyHistory(this.state.commits, server.commits, localId);
    server.branches[branch] = localId;
    this.state.remoteBranches[`${remoteName}/${branch}`] = localId;
    if (setUpstream) this.state.upstreams = { ...this.state.upstreams, [branch]: `${remoteName}/${branch}` };
    return { success: true, message: `To ${this.state.remotes[remoteName]}\n${branch} -> ${branch}`, newState: this.getState() };
  }

  private fetch(args: string[]): CommandResult {
    if (args.filter(arg => arg !== '--prune').length > 1 || args.includes('--')) return { success: false, message: 'このアプリは git fetch [--prune] [一つの接続先] に対応しています。refspecや追加引数は実行しません。' };
    const remoteName = args.find(arg => !arg.startsWith('-')) ?? 'origin';
    const server = this.state.mockServers[remoteName];
    if (!server || !this.state.remotes[remoteName]) return { success: false, message: `Unknown remote: ${remoteName}` };
    for (const [branch, id] of Object.entries(server.branches)) {
      copyHistory(server.commits, this.state.commits, id);
      this.state.remoteBranches[`${remoteName}/${branch}`] = id;
    }
    for (const [name, tag] of Object.entries(server.tags ?? {})) {
      copyHistory(server.commits, this.state.commits, tag.commitId);
      this.state.tags ??= dictionary();
      this.state.tags[name] ??= { ...tag };
    }
    if (args.includes('--prune')) {
      for (const name of Object.keys(this.state.remoteBranches)) {
        if (name.startsWith(remoteName + '/') && !server.branches[name.slice(remoteName.length + 1)]) delete this.state.remoteBranches[name];
      }
    }
    return { success: true, message: 'Fetched remote history; local branches and working files are unchanged.', newState: this.getState() };
  }

  private pull(args: string[]): CommandResult {
    if (args.filter(arg => !arg.startsWith('-')).length > 2 || args.includes('--') || (args.includes('--rebase') && args.includes('--ff-only'))) return { success: false, message: 'このアプリは git pull [--rebase または --ff-only] [接続先] [一つのブランチ] に対応しています。追加引数は実行しません。' };
    if (this.state.HEAD.type !== 'branch') return { success: false, message: 'Switch to a branch first.' };
    if (!cleanTrackedFiles(this.state)) return { success: false, message: 'Commit or stash local changes before pulling.' };
    const branch = this.state.HEAD.value;
    const positional = args.filter(arg => !arg.startsWith('-'));
    const tracking = this.state.upstreams?.[branch]?.split('/');
    const remote = positional[0] ?? tracking?.[0] ?? 'origin';
    const target = positional[1] ?? (tracking ? tracking.slice(1).join('/') : branch);
    const fetched = this.fetch([remote]);
    if (!fetched.success) return fetched;
    const ref = `${remote}/${target}`;
    const id = this.state.remoteBranches[ref];
    if (!id) return { success: false, message: 'Remote branch not found.', newState: this.getState() };
    if (args.includes('--ff-only') && !isAncestor(this.state.commits, this.state.branches[branch], id) && !isAncestor(this.state.commits, id, this.state.branches[branch])) return { success: false, message: 'Not possible to fast-forward.', newState: this.getState() };
    const result = args.includes('--rebase') ? this.rebase([ref]) : this.merge([ref]);
    return { ...result, newState: this.getState() };
  }

  private merge(args: string[]): CommandResult {
    const targets = args.filter(arg => !['--abort', '--no-ff', '--ff-only'].includes(arg));
    if ((args.includes('--abort') && args.length !== 1) || targets.length > 1 || targets.some(arg => arg.startsWith('-')) || (args.includes('--no-ff') && args.includes('--ff-only'))) return { success: false, message: 'このアプリは git merge [--no-ff|--ff-only] <一つのブランチ> または git merge --abort に対応しています。余分な引数は実行しません。' };
    if (args[0] === '--abort') {
      const pending = this.state.pendingMerge;
      if (!pending) return { success: false, message: 'No merge in progress.' };
      const ours = headTree(this.state);
      const theirs = this.state.commits[pending.targetId].tree;
      const untracked = Object.fromEntries(Object.entries(untrackedFiles(this.state)).filter(([path]) => ours[path] === theirs[path]));
      this.state.workingDirectory = { ...pending.workingDirectory, ...untracked };
      this.state.index = pending.index;
      delete this.state.pendingMerge;
      clearUnmergedPaths(this.state);
      return { success: true, message: 'Merge aborted.', newState: this.getState() };
    }
    if (this.state.pendingMerge || this.state.operation || hasUnmergedPaths(this.state)) return { success: false, message: 'Complete or abort the current operation first.' };
    if (!cleanTrackedFiles(this.state)) return { success: false, message: 'Commit or stash local changes before merging.' };
    if (args.length === 0) {
      return { success: false, message: 'fatal: No branch specified' };
    }

    const targetBranchName = args.find(arg => !arg.startsWith('-')) ?? '';
    const targetCommitId = resolveRevision(this.state, targetBranchName);

    if (!targetCommitId) {
      return { success: false, message: `fatal: '${targetBranchName}' does not point to a valid commit` };
    }

    const currentHeadId = this.resolveHeadCommitId();
    if (!currentHeadId) {
      return { success: false, message: 'fatal: You are not currently on a branch.' };
    }

    if (currentHeadId === targetCommitId) {
      return { success: true, message: 'Already up to date.' };
    }

    // 共通の祖先（マージベース）を検索
    const mergeBaseId = this.findMergeBase(currentHeadId, targetCommitId);
    if (!mergeBaseId) {
      return { success: false, message: 'fatal: refusing to merge unrelated histories' };
    }

    if (mergeBaseId === currentHeadId && !args.includes('--no-ff')) {
      const untracked = untrackedFiles(this.state);
      if (Object.keys(untracked).some(path => this.state.commits[targetCommitId].tree[path] !== undefined)) return { success: false, message: 'Untracked files would be overwritten.' };
      // Fast-forwardマージ
      if (this.state.HEAD.type === 'branch') {
        this.state.branches[this.state.HEAD.value] = targetCommitId;
      } else {
        this.state.HEAD.value = targetCommitId;
      }
      
      // WD/Indexを更新
      const newCommit = this.state.commits[targetCommitId];
      this.state.index = dictionary();
      this.state.workingDirectory = { ...newCommit.tree, ...untracked };
      
      return { success: true, message: `Updating ${currentHeadId.substring(0,7)}..${targetCommitId.substring(0,7)}\nFast-forward`, newState: this.state };
    } else if (mergeBaseId === targetCommitId) {
      return { success: true, message: 'Already up to date.' };
    }

    if (args.includes('--ff-only')) return { success: false, message: 'Not possible to fast-forward.' };
    // 3-wayマージロジック
    const baseCommit = this.state.commits[mergeBaseId];
    const currentCommit = this.state.commits[currentHeadId];
    const targetCommit = this.state.commits[targetCommitId];

    const allFiles = new Set([
      ...Object.keys(baseCommit.tree),
      ...Object.keys(currentCommit.tree),
      ...Object.keys(targetCommit.tree)
    ]);

    let hasConflict = false;
    const conflictedPaths: string[] = [];
    const newIndex = dictionary<FileChange>();
    const newWD = dictionary<string>();

    for (const file of allFiles) {
      const baseContent = baseCommit.tree[file];
      const currentContent = currentCommit.tree[file];
      const targetContent = targetCommit.tree[file];

      if (currentContent === targetContent) {
        // 変更なし、または両側で同じ変更
        if (currentContent !== undefined) {
          newWD[file] = currentContent;
          newIndex[file] = { path: file, status: 'staged', content: currentContent };
        }
      } else if (baseContent === currentContent) {
        // ターゲットのみ変更（ターゲットを採用して安全）
        if (targetContent !== undefined) {
          newWD[file] = targetContent;
          newIndex[file] = { path: file, status: 'staged', content: targetContent };
        }
      } else if (baseContent === targetContent) {
        // 現在のみ変更（現在を保持して安全）
        if (currentContent !== undefined) {
          newWD[file] = currentContent;
          newIndex[file] = { path: file, status: 'staged', content: currentContent };
        }
      } else {
        // コンフリクト検出（両側で異なる変更）
        hasConflict = true;
        conflictedPaths.push(file);
        const conflictContent = `<<<<<<< HEAD\n${currentContent || ''}\n=======\n${targetContent || ''}\n>>>>>>> ${targetBranchName}`;
        newWD[file] = conflictContent;
        // コンフリクト時、ファイルはWDで更新されるがステージされない
      }
    }

    for (const file of allFiles) {
      if (newWD[file] === undefined && currentCommit.tree[file] !== undefined) newIndex[file] = { path: file, status: 'deleted' };
    }
    const untracked = untrackedFiles(this.state);
    if (Object.keys(untracked).some(path => newWD[path] !== undefined)) return { success: false, message: 'Untracked files would be overwritten.' };
    const beforeMerge = { targetId: targetCommitId, workingDirectory: { ...this.state.workingDirectory }, index: { ...this.state.index } };
    this.state.workingDirectory = { ...newWD, ...untracked };
    
    if (hasConflict) {
      this.state.pendingMerge = beforeMerge;
      this.state.unmergedPaths = conflictedPaths;
      this.state.index = newIndex; // コンフリクトしていないファイルをステージ
      return { success: false, message: 'Automatic merge failed; fix conflicts and then commit the result.', newState: this.state };
    } else {
      // コンフリクトがなければ自動コミット
      this.state.index = newIndex;
      const commitMsg = `Merge branch '${targetBranchName}' into ${this.state.HEAD.type === 'branch' ? this.state.HEAD.value : 'HEAD'}`;
      
      const commitId = Math.random().toString(36).substring(2, 9);
      const newCommit: Commit = {
        id: commitId,
        message: commitMsg,
        parents: [currentHeadId, targetCommitId],
        timestamp: Date.now(),
        author: 'User',
        changes: Object.values(newIndex),
        tree: { ...newWD }
      };
      
      this.state.commits[commitId] = newCommit;
      if (this.state.HEAD.type === 'branch') {
        this.state.branches[this.state.HEAD.value] = commitId;
      } else {
        this.state.HEAD.value = commitId;
      }
      this.state.index = dictionary(); // インデックスをクリーンにする
      
      return { success: true, message: commitMsg, newState: this.state };
    }
  }

  /**
   * Helper to find the best common ancestor (merge base) between two commits.
   * Uses Breadth-First Search.
   */
  private findMergeBase(commitA: string, commitB: string): string | null {
    const ancestorsA = new Set<string>();
    const queueA = [commitA];
    while (queueA.length > 0) {
      const c = queueA.shift()!;
      if (ancestorsA.has(c)) continue;
      ancestorsA.add(c);
      const commit = this.state.commits[c];
      if (commit) {
        queueA.push(...commit.parents);
      }
    }

    const queueB = [commitB];
    const visitedB = new Set<string>();
    while (queueB.length > 0) {
      const c = queueB.shift()!;
      if (visitedB.has(c)) continue;
      visitedB.add(c);
      if (ancestorsA.has(c)) return c; // First common ancestor found
      const commit = this.state.commits[c];
      if (commit) {
        queueB.push(...commit.parents);
      }
    }
    return null;
  }

  private getHeadContent(path: string): string | undefined {
     const headId = this.resolveHeadCommitId();
     if (!headId) return undefined;
    return this.state.commits[headId].tree[path];
  }

  private init(): CommandResult {
    return { success: true, message: Object.keys(this.state.commits).length ? 'Reinitialized existing Git repository' : 'Initialized empty Git repository', newState: this.getState() };
  }

  private add(args: string[]): CommandResult {
    const targets: string[] = [];
    const flags = new Set<string>();
    let literal = false;
    for (const arg of args) {
      if (!literal && arg === '--') literal = true;
      else if (!literal && ['-A', '-f', '-p', '--patch'].includes(arg)) flags.add(arg);
      else targets.push(arg);
    }
    if (flags.has('-p') || flags.has('--patch')) {
      if (targets.length > 1 || flags.has('-A') || flags.has('-f')) return { success: false, message: 'このアプリの部分stageは git add -p [一つのファイル] に対応しています。' };
      return this.startPatch(targets[0]);
    }
    if (!args.length) return { success: false, message: 'Nothing specified, nothing added.' };
    const head = headTree(this.state);
    const all = targets.includes('.') || (flags.has('-A') && !targets.length);
    const paths = all
      ? [...new Set([...Object.keys(head), ...Object.keys(this.state.workingDirectory), ...Object.keys(this.state.index)])]
      : targets;
    if (!all && !paths.length) return { success: false, message: 'git addでstageするファイルか、-Aを指定してください。' };
    const visiblePaths = paths.filter(path => inSparseScope(this.state, path) && (flags.has('-f') || !isIgnored(this.state, path)));
    if (!all && visiblePaths.length !== paths.length) return { success: false, message: 'Ignored or excluded file. Use git add -f for ignored files, or expand sparse-checkout.' };
    if (paths.some(path => this.state.workingDirectory[path] === undefined && head[path] === undefined && !this.state.index[path])) {
      return { success: false, message: 'pathspec did not match any files' };
    }
    for (const path of visiblePaths) {
      const content = this.state.workingDirectory[path];
      this.state.index[path] = content === undefined
        ? { path, status: 'deleted' }
        : { path, status: content === head[path] ? 'unmodified' : 'staged', content };
    }
    // Like Git, staging records the user's choice, even when marker text remains.
    // Lesson content requirements decide whether that choice is a correct resolution.
    clearUnmergedPaths(this.state, new Set(visiblePaths));
    return { success: true, message: '', newState: this.getState() };
  }

  private commit(args: string[]): CommandResult {
    const messages: string[] = [];
    let amend = false;
    let noEdit = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-m') {
        if (args[i + 1] === undefined) return { success: false, message: 'git commit: -m requires a message.' };
        messages.push(args[++i]);
      } else if (arg === '--amend') amend = true;
      else if (arg === '--no-edit') noEdit = true;
      else {
        return this.unsupportedArgument('commit', arg, '-m <message>, --amend, --no-edit (with --amend)', [
          '-a', '--all', '--allow-empty', '--allow-empty-message', '--message', '-F', '--file',
          '--author', '--date', '-s', '--signoff', '-S', '--gpg-sign', '-q', '--quiet', '-v', '--verbose',
          '--dry-run', '--no-verify', '-n', '--only', '-o', '--include', '-i', '--fixup', '--squash', '--reset-author',
        ]);
      }
    }
    if (noEdit && !amend) return { success: false, message: 'このアプリでは --no-edit は --amend と併用してください。' };
    const parentId = this.resolveHeadCommitId();
    const previous = parentId ? this.state.commits[parentId] : undefined;
    const message = messages.length ? messages.join('\n\n') : amend && noEdit ? previous?.message : undefined;
    if (!message) return { success: false, message: 'Specify a message using -m, or --amend --no-edit.' };
    if (amend && !previous) return { success: false, message: 'No commit to amend.' };
    const newTree = indexTree(this.state);
    if (hasUnmergedPaths(this.state)) return { success: false, message: '競合ファイルを解消してgit addでstageしてください。git statusで未解消パスを確認できます。' };
    if (this.state.pendingMerge && (
      [...new Set([...Object.keys(newTree), ...Object.keys(headTree(this.state))])].filter(path => inSparseScope(this.state, path)).some(path => newTree[path] !== this.state.workingDirectory[path]))) {
      return { success: false, message: 'Resolve and stage all merge changes first.' };
    }
    if (!amend && !this.state.pendingMerge && sameTree(newTree, headTree(this.state))) return { success: false, message: 'nothing to commit' };
    const commitId = Math.random().toString(36).substring(2, 9);
    this.state.commits[commitId] = {
      id: commitId, message,
      parents: this.state.pendingMerge && parentId ? [parentId, this.state.pendingMerge.targetId] : amend ? previous!.parents : parentId ? [parentId] : [],
      timestamp: Date.now(), author: this.state.config?.['user.name'] ?? 'User',
      changes: Object.values(this.state.index).filter(entry => entry.status !== 'unmodified'), tree: newTree
    };
    if (this.state.HEAD.type === 'branch') this.state.branches[this.state.HEAD.value] = commitId;
    else this.state.HEAD.value = commitId;
    this.state.index = dictionary();
    delete this.state.pendingMerge;
    return { success: true, message: `[${this.state.HEAD.value}] ${message}`, newState: this.getState() };
  }

  private status(args: string[] = []): CommandResult {
    for (const arg of args) {
      if (arg !== '--ignored') return this.unsupportedArgument('status', arg, '--ignored', [
        '-s', '--short', '-b', '--branch', '--porcelain', '-z', '--null', '-u', '--untracked-files',
        '--show-stash', '--ignore-submodules', '--column', '--no-column', '--ahead-behind', '--no-ahead-behind', '--verbose', '-v',
      ]);
    }
    const files = fileStates(this.state);
    const conflicts = files.filter(file => file.conflict);
    const staged = files.filter(file => file.staged && !file.conflict);
    const modified = files.filter(file => file.unstaged && !file.conflict);
    const untracked = files.filter(file => file.untracked && !file.conflict);
    const ignored = files.filter(file => file.ignored);
    const lines = [this.state.HEAD.type === 'branch' ? `On branch ${this.state.HEAD.value}` : `HEAD detached at ${this.state.HEAD.value}`];
    if (conflicts.length) lines.push('Unmerged paths:', ...conflicts.map(file => `  unmerged: ${file.path}`));
    if (staged.length) lines.push('Changes to be committed:', ...staged.map(file => `  ${file.staged === 'deleted' ? 'deleted' : 'staged'}: ${file.path}`));
    if (modified.length) lines.push('Changes not staged for commit:', ...modified.map(file => `  ${file.unstaged === 'deleted' ? 'deleted' : 'modified'}: ${file.path}`));
    if (untracked.length) lines.push('Untracked files:', ...untracked.map(file => `  ${file.path}`));
    if (args.includes('--ignored') && ignored.length) lines.push('Ignored files:', ...ignored.map(file => `  ${file.path}`));
    if (!staged.length && !modified.length && !untracked.length && !conflicts.length) lines.push('nothing to commit, working tree clean');
    return { success: true, message: lines.join('\n') };
  }

  private unsupportedArgument(command: string, arg: string, supported: string, knownOptions: string[]): CommandResult {
    const known = knownOptions.includes(arg.split('=')[0]) ||
      knownOptions.some(option => !option.startsWith('--') && arg.startsWith(option) && arg !== option);
    const reason = !arg.startsWith('-') || known ? 'このアプリでは未対応の引数' : '不明または未対応のオプション';
    return { success: false, message: `git ${command}: ${reason}: ${arg}\n対応: ${supported}` };
  }

  private log(args: string[] = []): CommandResult {
    const separatorAt = args.indexOf('--');
    const options = separatorAt < 0 ? args : args.slice(0, separatorAt);
    for (let i = 0; i < options.length; i++) {
      if (options[i] === '--grep') { i++; continue; }
      if (!['--oneline', '--graph', '--all'].includes(options[i])) return { success: false, message: 'このアプリはlogの--oneline、--graph、--all、--grep <文字列>、-- <一つのパス>に対応しています。' };
    }
    if (separatorAt >= 0 && args.length !== separatorAt + 2) return { success: false, message: 'logの -- の後に一つのパスを指定してください。' };
    const currentCommitId = this.resolveHeadCommitId();
    if (!currentCommitId) {
      return { success: false, message: "fatal: your current branch 'main' does not have any commits yet" };
    }

    const ids: string[] = [];
    const pending = args.includes('--all') ? Object.values(this.state.branches).concat(Object.values(this.state.remoteBranches)) : [currentCommitId];
    const seen = new Set<string>();
    while (pending.length) {
      const id = pending.shift()!;
      const commit = this.state.commits[id];
      if (!commit || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      pending.push(...commit.parents);
    }
    const separator = args.indexOf('--');
    const file = separator >= 0 ? args[separator + 1] : undefined;
    const grep = args.indexOf('--grep');
    const selected = ids.filter(id => {
      const commit = this.state.commits[id];
      if (grep >= 0 && !commit.message.includes(args[grep + 1] ?? '')) return false;
      if (file) return commit.tree[file] !== this.state.commits[commit.parents[0]]?.tree[file];
      return true;
    });
    const output = selected.map(id => {
      const commit = this.state.commits[id];
      const graph = args.includes('--graph') ? `* [${commit.parents.join(', ')}] ` : '';
      return args.includes('--oneline') ? `${graph}${id} ${commit.message}` : `${graph}commit ${id}\nAuthor: ${commit.author}\nDate: ${new Date(commit.timestamp).toISOString()}\n\n    ${commit.message}`;
    });
    return { success: true, message: output.join('\n\n') };
  }

  private configure(args: string[]): CommandResult {
    const values = args.filter(arg => !['--global', '--local'].includes(arg));
    if (values.length > 2 || (values[0] === '--list' && values.length !== 1) || args.includes('--')) return { success: false, message: 'このアプリは git config [--local|--global] <キー> [一つの値] または --list に対応しています。空白を含む値は引用符で囲んでください。' };
    this.state.config ??= dictionary();
    if (values[0] === '--list') return { success: true, message: Object.entries(this.state.config).map(([key, value]) => `${key}=${value}`).join('\n') };
    const [key, value] = values;
    if (!key) return { success: false, message: 'git config <key> [value]' };
    if (value === undefined) return this.state.config[key] === undefined ? { success: false, message: 'Setting not found.' } : { success: true, message: this.state.config[key] };
    this.state.config[key] = value;
    return { success: true, message: '設定をこの模擬リポジトリに保存しました。', newState: this.getState() };
  }

  private tag(args: string[]): CommandResult {
    this.state.tags ??= dictionary();
    if (!args.length) return { success: true, message: Object.keys(this.state.tags).sort().join('\n') };
    const targets: string[] = [];
    let annotated = false;
    let deleting = false;
    let message: string | undefined;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-a') annotated = true;
      else if (args[i] === '-d') deleting = true;
      else if (args[i] === '-m') { message = args[++i]; annotated = true; }
      else if (args[i].startsWith('-')) return { success: false, message: 'このアプリのtagは一つの名前と開始コミット、-a/-m、または -d に対応しています。' };
      else targets.push(args[i]);
    }
    if ((deleting && (annotated || targets.length !== 1)) || (!deleting && (targets.length < 1 || targets.length > 2))) return { success: false, message: 'このアプリは tag [-a] <一つの名前> [コミット] [-m "注釈"] または tag -d <一つの名前> に対応しています。' };
    if (deleting) {
      if (!this.state.tags[targets[0]]) return { success: false, message: 'Tag not found.' };
      delete this.state.tags[targets[0]];
      return { success: true, message: 'Deleted tag.', newState: this.getState() };
    }
    const name = targets[0];
    const id = resolveRevision(this.state, targets[1] ?? 'HEAD');
    if (!name || !id || this.state.tags[name]) return { success: false, message: 'Specify a new tag and a valid commit.' };
    if (annotated && !message) return { success: false, message: 'Annotated tags require -m.' };
    this.state.tags[name] = { commitId: id, ...(annotated ? { message } : {}) };
    return { success: true, message: '', newState: this.getState() };
  }

  private show(args: string[]): CommandResult {
    if (args.length > 1) return { success: false, message: 'このアプリはshow [コミットまたはコミット:パス]に対応しています。' };
    const value = args[0] ?? 'HEAD';
    const [reference, path] = value.split(':');
    const id = resolveRevision(this.state, reference);
    if (!id) return { success: false, message: 'Commit not found.' };
    const commit = this.state.commits[id];
    if (path) return commit.tree[path] === undefined ? { success: false, message: 'File not found.' } : { success: true, message: commit.tree[path] };
    const parent = this.state.commits[commit.parents[0]]?.tree ?? {};
    let message = `commit ${id}\n${commit.message}\n`;
    if (this.state.tags?.[reference]?.message) message = `tag ${reference}\n${this.state.tags[reference].message}\n` + message;
    for (const file of new Set([...Object.keys(parent), ...Object.keys(commit.tree)])) if (parent[file] !== commit.tree[file]) message += generateDiff(file, parent[file] ?? '', commit.tree[file] ?? '');
    return { success: true, message };
  }

  private isFileInHead(path: string): boolean {
    const headId = this.resolveHeadCommitId();
    if (!headId) return false;
    return this.state.commits[headId].tree[path] !== undefined;
  }

  private resolveHeadCommitId(): string | null {
    if (this.state.HEAD.type === 'commit') {
      return this.state.HEAD.value;
    }
    return this.state.branches[this.state.HEAD.value] || null;
  }

  /**
   * Updates a file in the working directory.
   * Used by the UI to simulate file edits.
   */
  public touch(filename: string, content: string = '') {
    if (this.state.workingDirectory[filename] !== content) this.revision++;
    this.state.workingDirectory[filename] = content;
  }

  private branch(args: string[]): CommandResult {
    if ((args[0] === '-a' && args.length !== 1) || (args[0] === '-m' && ![2, 3].includes(args.length)) || (['-d', '-D'].includes(args[0]) && args.length !== 2) || (!['-a', '-m', '-d', '-D'].includes(args[0]) && args.length > 2)) return { success: false, message: '対応: git branch [-a] / <名前> [開始コミット] / -m [旧名] <新名> / -d|-D <一つの名前>。余分な引数は実行しません。' };
    const current = this.state.HEAD.type === 'branch' ? this.state.HEAD.value : '';
    if (!args.length || args[0] === '-a') {
      const local = Object.keys(this.state.branches).map(name => `${name === current ? '* ' : '  '}${name}`);
      if (args[0] === '-a') local.push(...Object.keys(this.state.remoteBranches).map(name => `  remotes/${name}`));
      return { success: true, message: local.join('\n') };
    }
    if (args[0] === '-m') {
      const oldName = args.length > 2 ? args[1] : current;
      const name = args.length > 2 ? args[2] : args[1];
      if (!name || !this.state.branches[oldName] || name in this.state.branches) return { success: false, message: 'Specify an existing branch and a new name.' };
      this.state.branches[name] = this.state.branches[oldName];
      delete this.state.branches[oldName];
      if (current === oldName) this.state.HEAD.value = name;
      for (const tree of Object.values(this.state.worktrees ?? {})) if (tree.branch === oldName) tree.branch = name;
      if (this.state.upstreams?.[oldName]) { this.state.upstreams[name] = this.state.upstreams[oldName]; delete this.state.upstreams[oldName]; }
      return { success: true, message: 'Renamed branch.', newState: this.getState() };
    }
    if (args[0] === '-d' || args[0] === '-D') {
      const name = args[1];
      if (!name || !this.state.branches[name] || name === current) return { success: false, message: 'Cannot delete this branch.' };
      if (Object.values(this.state.worktrees ?? {}).some(tree => tree.branch === name)) return { success: false, message: 'Branch is checked out in a worktree.' };
      const target = this.state.upstreams?.[name];
      const mergedInto = target ? this.state.remoteBranches[target] : this.resolveHeadCommitId();
      if (args[0] === '-d' && (!mergedInto || !isAncestor(this.state.commits, this.state.branches[name], mergedInto))) return { success: false, message: 'Branch is not fully merged.' };
      delete this.state.branches[name];
      if (this.state.upstreams) delete this.state.upstreams[name];
      return { success: true, message: 'Deleted branch.', newState: this.getState() };
    }
    const name = args[0];
    const id = resolveRevision(this.state, args[1] ?? 'HEAD');
    if (!id || name.startsWith('-') || name in this.state.branches) return { success: false, message: 'Specify a new branch and a valid start point.' };
    this.state.branches[name] = id;
    return { success: true, message: '', newState: this.getState() };
  }

  private switchBranch(args: string[]): CommandResult {
    let create: string | undefined;
    let detach = false;
    let track = false;
    let pathsOnly = false;
    const targets: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!pathsOnly && arg === '--') pathsOnly = true;
      else if (!pathsOnly && ['-c', '--create'].includes(arg)) {
        if (create !== undefined || !args[i + 1] || args[i + 1].startsWith('-')) return { success: false, message: 'git switch -c <new-branch> [start-point]' };
        create = args[++i];
      } else if (!pathsOnly && ['-d', '--detach'].includes(arg)) detach = true;
      else if (!pathsOnly && ['-t', '--track'].includes(arg)) track = true;
      else if (!pathsOnly && arg.startsWith('-')) return this.unsupportedArgument('switch', arg, '<branch>, -c <new-branch> [start-point], --detach [commit], --track <remote/branch>', ['-C', '--force-create', '-f', '--force', '--discard-changes', '--orphan', '--guess', '--no-guess', '--merge']);
      else targets.push(arg);
    }
    if (targets.length > 1 || (detach && (create !== undefined || track))) return { success: false, message: 'Specify one target and choose either a branch or --detach.' };
    const target = targets[0];
    if (track) {
      const name = create ?? target?.split('/').slice(1).join('/');
      if (!target || !name || !Object.hasOwn(this.state.remoteBranches, target)) return { success: false, message: 'Fetch the remote branch, then specify --track <remote/branch>.' };
      const result = this.checkout(['-b', name, target]);
      if (result.success) this.state.upstreams = dictionary({ ...this.state.upstreams, [name]: target });
      return result;
    }
    if (create !== undefined) return this.checkout(['-b', create, target ?? 'HEAD']);
    if (detach) return this.checkout(['--detach', target ?? 'HEAD']);
    if (!target) return { success: false, message: 'git switch <branch> or git switch --detach <commit>' };
    if (!Object.hasOwn(this.state.branches, target)) return { success: false, message: `git switch: a local branch is required: ${target}\nコミットを調べるには git switch --detach ${target} を使ってください。` };
    return this.checkout([target]);
  }

  private checkout(args: string[]): CommandResult {
    if ((args[0] === '-b' && ![2, 3].includes(args.length)) || (args[0] === '--detach' && args.length > 2) || (!['-b', '--detach'].includes(args[0]) && args.length > 1)) return { success: false, message: 'このアプリは checkout <参照> / -b <新規ブランチ> [開始コミット] / --detach [コミット] に対応しています。ファイルの復元はgit restoreを使ってください。' };
    if (args.length === 0) {
      return { success: false, message: 'checkout: missing argument' };
    }

    let target = args[0];
    // checkout HEAD retains an attached branch; expressions such as HEAD~0 detach.
    if (target === 'HEAD' && this.state.HEAD.type === 'branch') target = this.state.HEAD.value;
    let createBranch = false;
    const detached = target === '--detach';
    if (detached) target = args[1] ?? 'HEAD';

    if (target === '-b') {
      createBranch = true;
      target = args[1];
    }

    if (this.state.pendingMerge || this.state.operation || hasUnmergedPaths(this.state)) return { success: false, message: 'Complete or abort the current operation first.' };
    if (createBranch && !target) return { success: false, message: 'Specify a branch name.' };
    if (createBranch) {
      const branchRes = this.branch([target, args[2] ?? 'HEAD']);
      if (!branchRes.success) return branchRes;
    }

    const targetId = resolveRevision(this.state, target);
    if (!detached && Object.entries(this.state.worktrees ?? {}).some(([path, tree]) => path !== this.state.activeWorktree && tree.branch === target)) return { success: false, message: 'Branch is already checked out in another worktree.' };
    const targetTree = targetId ? this.state.commits[targetId]?.tree : undefined;
    const previousTree = headTree(this.state);
    const currentIndex = indexTree(this.state);
    if (targetTree) {
      const paths = new Set([...Object.keys(previousTree), ...Object.keys(currentIndex), ...Object.keys(this.state.workingDirectory), ...Object.keys(targetTree)]);
      for (const path of paths) {
        if (!inSparseScope(this.state, path)) continue;
        const locallyChanged = currentIndex[path] !== previousTree[path] || this.state.workingDirectory[path] !== currentIndex[path];
        if (locallyChanged && targetTree[path] !== previousTree[path]) {
          return { success: false, message: `Local changes would be overwritten: ${path}` };
        }
      }
    }
    const preserved = dictionary(this.state.workingDirectory);
    const preservedIndex = dictionary(this.state.index);
    const carryChanges = (tree: Record<string, string>) => {
      this.state.workingDirectory = dictionary(tree);
      this.state.index = dictionary();
      for (const path of new Set([...Object.keys(previousTree), ...Object.keys(currentIndex), ...Object.keys(preserved)])) {
        if (!inSparseScope(this.state, path)) continue;
        if (currentIndex[path] !== previousTree[path] || preserved[path] !== currentIndex[path]) {
          if (preserved[path] === undefined) delete this.state.workingDirectory[path];
          else this.state.workingDirectory[path] = preserved[path];
          if (preservedIndex[path]) this.state.index[path] = preservedIndex[path];
        }
      }
    };
    // Switch to branch
    if (!detached && Object.hasOwn(this.state.branches, target)) {
      this.state.HEAD = { type: 'branch', value: target };
      this.state.detachedHead = false;
      
      // Update WD/Index to match new HEAD (simplified: just reset index, keep WD changes if safe? 
      // For this sim, let's just load the tree of the commit)
      const commitId = this.state.branches[target];
      const commit = this.state.commits[commitId];
      if (commit) {
        carryChanges(commit.tree);
      }
      
      return { success: true, message: `Switched to branch '${target}'`, newState: this.state };
    }

    // Detached HEAD (commit ID)
    if (targetId && this.state.commits[targetId]) {
      this.state.HEAD = { type: 'commit', value: targetId };
      this.state.detachedHead = true;
      const commit = this.state.commits[targetId];
      carryChanges(commit.tree);
      return { success: true, message: `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state.`, newState: this.state };
    }

    return { success: false, message: `error: pathspec '${target}' did not match any file(s) known to git` };
  }
  /**
   * Implements `git diff`.
   */
  private diff(args: string[]): CommandResult {
    const cached = args.includes('--cached') || args.includes('--staged');
    const separator = args.indexOf('--');
    const revisions = (separator < 0 ? args : args.slice(0, separator)).filter(arg => !arg.startsWith('-'));
    const files = separator < 0 ? [] : args.slice(separator + 1);
    if (revisions.length > 2 || (cached && revisions.length)) return { success: false, message: 'Use diff [commit [commit]] -- [path], or diff --staged.' };
    let left = cached ? headTree(this.state) : indexTree(this.state);
    let right = cached ? indexTree(this.state) : this.state.workingDirectory;
    if (revisions.length) {
      const ids = revisions.map(value => resolveRevision(this.state, value));
      if (ids.some(id => !id)) return { success: false, message: 'Revision not found.' };
      left = this.state.commits[ids[0]!].tree;
      if (ids[1]) right = this.state.commits[ids[1]].tree;
    }
    const paths = cached || revisions.length ? new Set([...Object.keys(left), ...Object.keys(right)]) : new Set(Object.keys(left));
    let output = '';
    for (const path of paths) {
      if (!cached && !revisions.length && !inSparseScope(this.state, path)) continue;
      if (files.length && !files.some(file => path === file || path.startsWith(file + '/'))) continue;
      if (left[path] !== right[path]) output += args.includes('--name-only') ? path + '\n' : generateDiff(path, left[path] ?? '', right[path] ?? '');
    }
    return { success: true, message: output };
  }

  private startPatch(path?: string): CommandResult {
    const index = indexTree(this.state);
    path ??= Object.keys(index).find(file => inSparseScope(this.state, file) && index[file] !== this.state.workingDirectory[file]);
    if (!path || index[path] === undefined || this.state.workingDirectory[path] === undefined) return { success: false, message: '変更した追跡ファイルを一つ指定してください。' };
    if (isUnmerged(this.state, path)) return { success: false, message: '先に競合を解消し、git addでstageしてください。' };
    const chunks: NonNullable<GitState['patchSession']>['chunks'] = [];
    for (const part of diffLines(index[path], this.state.workingDirectory[path])) {
      if (!part.added && !part.removed) chunks.push({ before: part.value, after: part.value, changed: false });
      else {
        let chunk = chunks.at(-1);
        if (!chunk?.changed) { chunk = { before: '', after: '', changed: true }; chunks.push(chunk); }
        if (part.removed) chunk.before += part.value;
        if (part.added) chunk.after += part.value;
      }
    }
    const cursor = chunks.findIndex(chunk => chunk.changed);
    if (cursor < 0) return { success: false, message: 'No changes.' };
    this.state.patchSession = { path, chunks, cursor };
    return { success: true, message: generateDiff(path, chunks[cursor].before, chunks[cursor].after) + '\nStage this hunk [y,n,q]?', newState: this.getState() };
  }

  private answerPatch(answer: string): CommandResult {
    const session = this.state.patchSession!;
    if (answer === 'q') { delete this.state.patchSession; return { success: true, message: '部分ステージングを終了しました。', newState: this.getState() }; }
    session.chunks[session.cursor].selected = answer === 'y';
    const content = session.chunks.map(chunk => chunk.selected ? chunk.after : chunk.before).join('');
    this.state.index[session.path] = { path: session.path, status: content === headTree(this.state)[session.path] ? 'unmodified' : 'staged', content };
    session.cursor = session.chunks.findIndex(chunk => chunk.changed && chunk.selected === undefined);
    if (session.cursor < 0) { delete this.state.patchSession; return { success: true, message: '選択した変更だけをステージしました。', newState: this.getState() }; }
    const chunk = session.chunks[session.cursor];
    return { success: true, message: generateDiff(session.path, chunk.before, chunk.after) + '\nStage this hunk [y,n,q]?', newState: this.getState() };
  }

  private blame(args: string[]): CommandResult {
    if (args.filter(arg => arg !== '--').length !== 1) return { success: false, message: 'このアプリは git blame [--] <一つの追跡ファイル> に対応しています。' };
    const path = args.filter(arg => arg !== '--').at(-1);
    if (!path || headTree(this.state)[path] === undefined) return { success: false, message: '追跡されているファイルを指定してください。' };
    const history: Commit[] = [];
    let id = this.resolveHeadCommitId();
    while (id && this.state.commits[id]) { history.unshift(this.state.commits[id]); id = this.state.commits[id].parents[0]; }
    const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    let previous = '';
    let origins: string[] = [];
    for (const commit of history) {
      const content = commit.tree[path] ?? '';
      const next: string[] = [];
      let cursor = 0;
      for (const part of diffLines(previous, content)) {
        const count = lines(part.value).length;
        if (part.added) next.push(...Array<string>(count).fill(commit.id));
        else if (part.removed) cursor += count;
        else { next.push(...origins.slice(cursor, cursor + count)); cursor += count; }
      }
      previous = content;
      origins = next;
    }
    return { success: true, message: lines(previous).map((line, i) => `${origins[i]} (${this.state.commits[origins[i]]?.author ?? 'User'} ${i + 1}) ${line.trimEnd()}`).join('\n') };
  }

  private restore(args: string[]): CommandResult {
    const staged = args.includes('--staged') || args.includes('-S');
    const worktree = !staged || args.includes('--worktree') || args.includes('-W');
    const sourceAt = args.includes('-s') ? args.indexOf('-s') : args.indexOf('--source');
    const explicit = args.find(arg => arg.startsWith('--source='))?.slice('--source='.length) ?? (sourceAt >= 0 ? args[sourceAt + 1] : undefined);
    const id = explicit ? resolveRevision(this.state, explicit) : undefined;
    if (explicit && !id) return { success: false, message: 'Source revision not found.' };
    const head = headTree(this.state);
    const source = id ? this.state.commits[id].tree : staged ? head : indexTree(this.state);
    let paths = args.filter((arg, index) => !arg.startsWith('-') && index !== sourceAt + 1);
    if (sourceAt < 0) paths = args.filter(arg => !arg.startsWith('-'));
    if (paths.includes('.')) paths = [...new Set([...Object.keys(source), ...Object.keys(head), ...Object.keys(this.state.index)])];
    if (!paths.length || paths.some(path => source[path] === undefined && head[path] === undefined && !this.state.index[path])) return { success: false, message: 'restore: specify tracked files' };
    if (paths.some(path => isUnmerged(this.state, path))) return { success: false, message: '未解消パスは内容を選んでgit addでstageしてください。操作全体を中断する場合は操作案内を使ってください。' };
    for (const path of paths) {
      if (staged) {
        if (source[path] === head[path]) delete this.state.index[path];
        else this.state.index[path] = source[path] === undefined ? { path, status: 'deleted' } : { path, status: 'staged', content: source[path] };
      }
      if (worktree) {
        if (source[path] === undefined) delete this.state.workingDirectory[path];
        else this.state.workingDirectory[path] = source[path];
      }
    }
    return { success: true, message: '', newState: this.getState() };
  }

  private fileOperation(command: string, args: string[]): CommandResult {
    if (command === 'rm') return this.removeFile(args);
    if (args.length !== 2) return { success: false, message: 'このアプリは git mv <一つのファイル> <新しい名前> に対応しています。' };
    const cached = command === 'rm' && args.includes('--cached');
    const [path, destination] = args.filter(arg => arg !== '--cached');
    const tracked = indexTree(this.state)[path];
    if (isUnmerged(this.state, path)) return { success: false, message: '移動する前に競合を解消してstageしてください。' };
    if (tracked === undefined) return { success: false, message: 'Specify a tracked file.' };
    if (!cached && this.state.workingDirectory[path] !== tracked) return { success: false, message: 'File has local changes; stage or restore them first.' };
    if (command === 'mv' && (!destination || this.state.workingDirectory[destination] !== undefined)) return { success: false, message: 'Specify a new destination.' };
    if (command === 'mv') {
      this.state.workingDirectory[destination] = tracked;
      this.state.index[destination] = { path: destination, status: 'staged', content: tracked };
    }
    if (!cached) delete this.state.workingDirectory[path];
    this.state.index[path] = { path, status: 'deleted' };
    return { success: true, message: '', newState: this.getState() };
  }

  private removeFile(args: string[]): CommandResult {
    let cached = false;
    let force = false;
    let pathsOnly = false;
    const paths: string[] = [];
    for (const arg of args) {
      if (!pathsOnly && arg === '--') pathsOnly = true;
      else if (!pathsOnly && arg === '--cached') cached = true;
      else if (!pathsOnly && ['-f', '--force'].includes(arg)) force = true;
      else if (!pathsOnly && arg.startsWith('-')) return this.unsupportedArgument('rm', arg, '[--cached] [-f|--force] [--] <file>', ['-r', '-n', '--dry-run', '-q', '--quiet', '--ignore-unmatch', '--sparse', '--pathspec-from-file']);
      else paths.push(arg);
    }
    if (paths.length !== 1) return { success: false, message: 'このアプリでは git rm [--cached] [-f|--force] [--] <file> で一つのファイルを指定してください。' };
    const path = paths[0];
    if (isUnmerged(this.state, path) && !force) return { success: false, message: '未解消パスの削除で解決する場合は git rm -f <ファイル> を使います。内容を確認してから実行してください。' };
    const indexed = indexTree(this.state)[path];
    if (indexed === undefined) return { success: false, message: 'Specify a tracked file.' };
    if (!inSparseScope(this.state, path)) return { success: false, message: '先にsparse-checkoutの対象を広げてください。' };
    const working = this.state.workingDirectory[path];
    const committed = headTree(this.state)[path];
    // Git allows already-missing files to be removed. With --cached, either
    // HEAD or the working file must retain the staged content unless forced.
    if (!force && working !== undefined) {
      if (cached ? indexed !== committed && indexed !== working : indexed !== committed || indexed !== working) {
        return { success: false, message: cached
          ? 'Staged content differs from both HEAD and the working file. Restore it or use git rm --cached -f to force removal.'
          : 'File has staged or local changes. Commit or restore them, or use git rm -f to force removal.' };
      }
    }
    if (!cached) delete this.state.workingDirectory[path];
    this.state.index[path] = { path, status: 'deleted' };
    clearUnmergedPaths(this.state, new Set([path]));
    return { success: true, message: '', newState: this.getState() };
  }

  /**
   * Implements `git rebase`.
   * Simplified version: Replays commits from current branch onto target branch.
   */
  private rebase(args: string[]): CommandResult { return this.replayOperation('rebase', args); }
  private cherryPick(args: string[]): CommandResult { return this.replayOperation('cherry-pick', args); }
  private revert(args: string[]): CommandResult { return this.replayOperation('revert', args); }

  // Conflict files created by the operation are not unrelated untracked work.
  private replayUntrackedFiles(): Record<string, string> {
    const affected = new Set<string>();
    const current = this.state.operation?.current;
    for (const id of current ? [current.id] : []) {
      const commit = this.state.commits[id];
      const parent = this.state.commits[commit.parents[0]]?.tree ?? {};
      for (const path of new Set([...Object.keys(commit.tree), ...Object.keys(parent)])) {
        if (commit.tree[path] !== parent[path]) affected.add(path);
      }
    }
    return Object.fromEntries(Object.entries(untrackedFiles(this.state)).filter(([path]) => !affected.has(path)));
  }

  private replayOperation(kind: 'rebase' | 'cherry-pick' | 'revert', args: string[]): CommandResult {
    if (args.some(arg => ['--continue', '--abort', '--skip'].includes(arg)) && args.length !== 1) return { success: false, message: `git ${kind} の続行・中断・skipには追加引数を指定しないでください。` };
    if (kind === 'rebase' && args.filter(arg => !['-i', '--interactive', '--continue', '--abort', '--skip'].includes(arg)).length > 1) return { success: false, message: 'このアプリのrebaseは一つの載せ替え先に対応しています。追加のブランチ指定や--ontoには未対応です。' };
    const pending = this.state.operation;
    if (args[0] === '--abort') {
      if (!pending || pending.kind !== kind) return { success: false, message: 'No matching operation in progress.' };
      const untracked = Object.fromEntries(Object.entries(this.replayUntrackedFiles()).filter(([path]) => headTree(pending.original)[path] === undefined));
      const commits = this.state.commits;
      const reflog = this.state.reflog;
      this.state = cloneGitData(pending.original);
      this.state.workingDirectory = { ...this.state.workingDirectory, ...untracked };
      this.state.commits = { ...commits, ...this.state.commits };
      this.state.reflog = reflog;
      return { success: true, message: `${kind} aborted.`, newState: this.getState() };
    }
    if (args[0] === '--continue' || args[0] === '--skip') {
      if (!pending || pending.kind !== kind) return { success: false, message: 'No matching operation in progress.' };
      if (pending.awaiting === 'todo') {
        if (args[0] !== '--continue') return { success: false, message: 'Edit the todo and use --continue, or abort.' };
        const rows = (pending.todo ?? '').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => line.split(/\s+/));
        const allowed = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'];
        const ids = rows.map(row => row[1]);
        if (rows.some(row => !allowed.includes(row[0]) || !pending.remaining.includes(row[1])) || new Set(ids).size !== ids.length) return { success: false, message: 'Invalid todo: use each original commit at most once and a supported action.' };
        const first = rows.find(row => row[0] !== 'drop');
        if (first && ['squash', 'fixup'].includes(first[0])) return { success: false, message: 'The first kept commit cannot be squash or fixup.' };
        pending.actions = Object.fromEntries(rows.map(([action, id]) => [id, action])) as NonNullable<typeof pending.actions>;
        pending.remaining = ids;
        delete pending.awaiting;
        delete pending.todo;
        return this.runReplay();
      }
      if (!pending.current) return { success: false, message: 'No paused commit.' };
      if (pending.current.committed) {
        if (!cleanTrackedFiles(this.state)) return { success: false, message: 'Commit your edits before continuing.' };
        pending.remaining.shift();
        delete pending.current;
        delete pending.awaiting;
        return this.runReplay();
      }
      if (args[0] === '--continue') {
        const tree = indexTree(this.state);
        if (hasUnmergedPaths(this.state) ||
          [...new Set([...Object.keys(tree), ...Object.keys(headTree(this.state))])].filter(path => inSparseScope(this.state, path)).some(path => tree[path] !== this.state.workingDirectory[path])) return { success: false, message: 'Resolve and stage all changes first.' };
        const result = this.commit([...(pending.current.amend ? ['--amend'] : []), '-m', pending.current.message]);
        if (!result.success) return result;
      } else {
        this.state.workingDirectory = { ...headTree(this.state), ...this.replayUntrackedFiles() };
        this.state.index = dictionary();
        clearUnmergedPaths(this.state);
      }
      pending.remaining.shift();
      delete pending.current;
      return this.runReplay();
    }
    if (pending || this.state.pendingMerge || hasUnmergedPaths(this.state)) return { success: false, message: 'Complete or abort the current operation first.' };
    if (!cleanTrackedFiles(this.state)) return { success: false, message: 'Commit or stash local changes first.' };
    const interactive = kind === 'rebase' && (args.includes('-i') || args.includes('--interactive'));
    const targets = args.filter(arg => !['-i', '--interactive'].includes(arg));
    if (!targets.length || targets.some(arg => arg.startsWith('-'))) return { success: false, message: `${kind}: specify a commit or branch; supported controls: --continue/--abort/--skip` };
    const original = this.getState();
    const currentId = this.resolveHeadCommitId();
    if (!currentId) return { success: false, message: 'No current commit.' };
    let remaining: string[];
    if (kind === 'rebase') {
      if (this.state.HEAD.type !== 'branch') return { success: false, message: 'Switch to a branch before rebasing.' };
      const target = resolveRevision(this.state, targets[0]);
      if (!target) return { success: false, message: 'Target not found.' };
      const common = this.findMergeBase(currentId, target);
      if (!common) return { success: false, message: 'Unrelated histories.' };
      if (common === target && !interactive) return { success: true, message: 'Already up to date.' };
      remaining = [];
      let cursor: string | undefined = currentId;
      while (cursor && cursor !== common) {
        remaining.unshift(cursor);
        cursor = this.state.commits[cursor]?.parents[0];
      }
      const untracked = Object.fromEntries(Object.entries(this.state.workingDirectory).filter(([path]) => indexTree(this.state)[path] === undefined));
      if (Object.keys(untracked).some(path => this.state.commits[target].tree[path] !== undefined)) return { success: false, message: 'Untracked files would be overwritten.' };
      this.state.branches[this.state.HEAD.value] = target;
      this.state.workingDirectory = { ...this.state.commits[target].tree, ...untracked };
      this.state.index = dictionary();
      if (remaining.length === 0 && !interactive) return { success: true, message: 'Fast-forward.', newState: this.getState() };
    } else {
      const resolved = targets.map(arg => resolveRevision(this.state, arg));
      if (resolved.some(id => !id)) return { success: false, message: 'Commit not found.' };
      remaining = resolved as string[];
      if (remaining.some(id => this.state.commits[id].parents.length > 1)) return { success: false, message: 'Merge commits require a mainline choice; select a single-parent commit in this simulator.' };
    }
    this.state.operation = { kind, original, remaining };
    if (interactive) {
      this.state.operation.awaiting = 'todo';
      this.state.operation.todo = remaining.map(id => `pick ${id} ${this.state.commits[id].message}`).join('\n');
      return { success: true, message: 'todoを編集して git rebase --continue を実行してください。reword/editは適用後に一時停止し、commit --amendなどで編集できます。', newState: this.getState() };
    }
    return this.runReplay();
  }

  private runReplay(): CommandResult {
    const operation = this.state.operation!;
    while (operation.remaining.length) {
      const source = this.state.commits[operation.remaining[0]];
      const action = operation.actions?.[source.id] ?? 'pick';
      if (action === 'drop') { operation.remaining.shift(); continue; }
      const parent = this.state.commits[source.parents[0]] ?? { ...source, tree: {} };
      const ours = this.state.commits[this.resolveHeadCommitId()!];
      const untracked = Object.fromEntries(Object.entries(this.state.workingDirectory).filter(([path]) => indexTree(this.state)[path] === undefined));
      const result = operation.kind === 'revert' ? this.performThreeWayMerge(source, ours, parent) : this.performThreeWayMerge(parent, ours, source);
      if (Object.keys(untracked).some(path => result.tree[path] !== undefined)) return { success: false, message: 'Untracked files would be overwritten.' };
      const amend = action === 'squash' || action === 'fixup';
      const message = operation.kind === 'revert' ? `Revert "${source.message}"` : action === 'fixup' ? ours.message : action === 'squash' ? `${ours.message}\n\n${source.message}` : source.message;
      this.state.workingDirectory = { ...result.tree, ...untracked };
      if (result.conflictedPaths.length) this.state.unmergedPaths = result.conflictedPaths;
      else clearUnmergedPaths(this.state);
      this.state.index = dictionary();
      for (const path of new Set([...Object.keys(ours.tree), ...Object.keys(result.tree)])) {
        const content = result.tree[path];
        if (isUnmerged(this.state, path)) continue;
        this.state.index[path] = content === undefined ? { path, status: 'deleted' } : { path, status: 'staged', content };
      }
      if (result.hasConflict) {
        operation.current = { id: source.id, message, amend };
        return { success: false, message: `Conflict detected during ${operation.kind}. Resolve files, git add, then git ${operation.kind} --continue; or use --abort.`, newState: this.getState() };
      }
      if (!sameTree(ours.tree, result.tree)) {
        const committed = this.commit([...(amend ? ['--amend'] : []), '-m', message]);
        if (!committed.success) return committed;
      }
      if (action === 'edit' || action === 'reword') {
        operation.current = { id: source.id, message, committed: true };
        operation.awaiting = action;
        return { success: true, message: '一時停止しました。commit --amendでメッセージを変更するか、変更をコミットしてからgit rebase --continueを実行してください。', newState: this.getState() };
      }
      operation.remaining.shift();
    }
    const kind = operation.kind;
    delete this.state.operation;
    this.state.index = dictionary();
    return { success: true, message: kind === 'rebase' ? 'Successfully rebased.' : `Completed ${kind}: ${this.state.commits[this.resolveHeadCommitId()!]?.message}`, newState: this.getState() };
  }

  private performThreeWayMerge(base: Commit, ours: Commit, theirs: Commit): { tree: Record<string, string>, hasConflict: boolean, conflictedPaths: string[] } {
    const allFiles = new Set([
      ...Object.keys(base.tree),
      ...Object.keys(ours.tree),
      ...Object.keys(theirs.tree)
    ]);

    const newTree = dictionary<string>();
    let hasConflict = false;
    const conflictedPaths: string[] = [];

    for (const file of allFiles) {
      const baseContent = base.tree[file];
      const oursContent = ours.tree[file];
      const theirsContent = theirs.tree[file];

      if (oursContent === theirsContent) {
        if (oursContent !== undefined) newTree[file] = oursContent;
      } else if (baseContent === oursContent) {
        // Ours didn't change, accept Theirs
        if (theirsContent !== undefined) newTree[file] = theirsContent;
      } else if (baseContent === theirsContent) {
        // Theirs didn't change, accept Ours
        if (oursContent !== undefined) newTree[file] = oursContent;
      } else {
        hasConflict = true;
        conflictedPaths.push(file);
        // Simplified conflict content
        newTree[file] = `<<<<<<< HEAD\n${oursContent || ''}\n=======\n${theirsContent || ''}\n>>>>>>> ${theirs.id.substring(0,7)}`;
      }
    }
    return { tree: newTree, hasConflict, conflictedPaths };
  }
}
