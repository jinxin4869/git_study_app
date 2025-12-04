import { GitState, CommandResult, Commit, FileChange } from '@/types/git';
import { generateDiff } from '@/utils/diff-utils';

/**
 * GitEngine class simulates the core behavior of Git.
 * It manages the repository state including commits, branches, index, working directory, and remotes.
 */
export class GitEngine {
  private state: GitState;

  constructor(initialState?: GitState) {
    this.state = initialState || this.createInitialState();
  }

  /**
   * Creates the initial empty state of a git repository.
   */
  private createInitialState(): GitState {
    return {
      commits: {},
      branches: { main: '' }, // 'main' ブランチは存在するが、初期状態では何も指していない
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: {},
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {},
    };
  }

  /**
   * Returns a deep copy of the current state.
   */
  public getState(): GitState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Loads a new state into the engine.
   */
  public loadState(newState: GitState) {
    this.state = JSON.parse(JSON.stringify(newState));
  }

  /**
   * Executes a git command.
   * @param command The full command string (e.g., "git commit -m 'msg'")
   */
  public execute(command: string): CommandResult {
    const parts = command.trim().split(/\s+/);
    
    // 非Gitコマンドの処理
    if (parts[0] === 'touch') {
      const filename = parts[1];
      if (!filename) return { success: false, message: 'usage: touch <filename>' };
      // touchのシミュレーション: 存在しない場合は作成、存在する場合はタイムスタンプ更新（内容は変更なし）
      if (this.state.workingDirectory[filename] === undefined) {
        this.touch(filename, '');
        return { success: true, message: '', newState: this.state };
      }
      return { success: true, message: '', newState: this.state };
    }

    if (parts[0] === 'echo') {
      // echo "content" > filename の簡易パース
      const redirectIndex = parts.indexOf('>');
      if (redirectIndex === -1 || redirectIndex === parts.length - 1) {
        return { success: false, message: 'usage: echo "content" > <filename>' };
      }
      
      const filename = parts[redirectIndex + 1];
      // echo と > の間の部分を結合
      let content = parts.slice(1, redirectIndex).join(' ');
      
      // 引用符があれば削除
      if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
        content = content.slice(1, -1);
      }
      
      this.touch(filename, content);
      return { success: true, message: '', newState: this.state };
    }

    if (parts[0] !== 'git') {
      return { success: false, message: "Command must start with 'git', 'touch', or 'echo'" };
    }

    const cmd = parts[1];
    const args = parts.slice(2);

    switch (cmd) {
      case 'init':
        return this.init();
      case 'add':
        return this.add(args);
      case 'commit':
        return this.commit(args);
      case 'status':
        return this.status();
      case 'log':
        return this.log();
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

    // 引数のパース
    if (args.length > 0) {
      if (args[0].startsWith('--')) {
        const m = args[0].replace('--', '');
        if (m === 'soft' || m === 'mixed' || m === 'hard') {
          mode = m;
          if (args.length > 1) target = args[1];
        } else {
          return { success: false, message: `git reset: unknown option ${args[0]}` };
        }
      } else {
        target = args[0];
      }
    }

    // ターゲットコミットIDの解決
    let commitId = target;
    if (target === 'HEAD') {
      const headId = this.resolveHeadCommitId();
      if (!headId) return { success: false, message: 'Failed to resolve HEAD' };
      commitId = headId;
    } else if (target.startsWith('HEAD~')) {
      const n = parseInt(target.split('~')[1]);
      let current = this.resolveHeadCommitId();
      for (let i = 0; i < n; i++) {
        if (!current) break;
        current = this.state.commits[current].parents[0];
      }
      if (!current) return { success: false, message: `Commit ${target} not found` };
      commitId = current;
    } else {
       // ブランチと生のコミットIDを確認
       if (this.state.branches[target]) {
         commitId = this.state.branches[target];
       } else if (!this.state.commits[target]) {
         const fullId = Object.keys(this.state.commits).find(id => id.startsWith(target));
         if (fullId) commitId = fullId;
         else return { success: false, message: `Commit ${target} not found` };
       }
    }

    const targetCommit = this.state.commits[commitId];
    if (!targetCommit) return { success: false, message: `Commit ${commitId} not found` };

    // HEADをターゲットコミットに移動
    if (this.state.HEAD.type === 'branch') {
      this.state.branches[this.state.HEAD.value] = commitId;
    } else {
      this.state.HEAD.value = commitId;
    }

    // モードに基づいてインデックスとワーキングディレクトリを更新
    if (mode === 'soft') {
      // Soft reset: HEADのみ移動、インデックスとWDは変更なし。
      // 新しいHEADとインデックスの間の変更は「ステージ済み」となる。
    } else if (mode === 'mixed') {
      // Mixed reset: HEAD移動、インデックスはHEADに合わせてリセット、WDは変更なし。
      // インデックス（現在はHEAD）とWDの間の変更は「未ステージ」となる。
      this.state.index = {}; // 簡易化: インデックスをクリアすることで、このモデルでは実質的にHEADと一致させる
    } else if (mode === 'hard') {
      // Hard reset: HEAD移動、インデックスとWDもHEADに合わせてリセット。
      this.state.index = {};
      this.state.workingDirectory = { ...targetCommit.tree };
    }

    return { success: true, message: `HEAD is now at ${commitId.substring(0,7)} ${targetCommit.message}`, newState: this.state };
  }

  /**
   * Implements `git stash`.
   * Supports push, pop, apply, list.
   */
  private stash(args: string[]): CommandResult {
    const subcmd = args[0] || 'push'; // default to push
    
    if (subcmd === 'push' || subcmd === 'save') {
      // ローカルの変更を確認
      const hasChanges = Object.keys(this.state.index).length > 0 || 
                         Object.keys(this.state.workingDirectory).some(f => !this.isFileInHead(f) || this.state.workingDirectory[f] !== this.getHeadContent(f));
      
      if (!hasChanges) return { success: false, message: 'No local changes to save' };

      const stashId = Math.random().toString(36).substring(2, 7);
      const message = args.length > 1 ? args.slice(1).join(' ') : `WIP on ${this.state.HEAD.type === 'branch' ? this.state.HEAD.value : 'detached'}: ${stashId}`;
      
      // 現在の状態をstashリストに保存
      this.state.stash.push({
        id: stashId,
        message,
        index: { ...this.state.index },
        workingDirectory: { ...this.state.workingDirectory },
        timestamp: Date.now()
      });

      // ワークスペースをクリーンにするためにHEADへHard reset
      const headId = this.resolveHeadCommitId();
      if (headId) {
        const headCommit = this.state.commits[headId];
        this.state.index = {};
        this.state.workingDirectory = { ...headCommit.tree };
      }

      return { success: true, message: `Saved working directory and index state ${message}`, newState: this.state };
    } else if (subcmd === 'pop' || subcmd === 'apply') {
      if (this.state.stash.length === 0) return { success: false, message: 'No stash entries found.' };
      
      const entry = this.state.stash[this.state.stash.length - 1];
      
      // stashから状態を復元
      this.state.index = { ...entry.index };
      this.state.workingDirectory = { ...entry.workingDirectory };
      
      if (subcmd === 'pop') {
        this.state.stash.pop();
        return { success: true, message: `Dropped ${entry.message} and applied changes`, newState: this.state };
      }
      return { success: true, message: `Applied ${entry.message}`, newState: this.state };
    } else if (subcmd === 'list') {
      const list = this.state.stash.map((s, i) => `stash@{${this.state.stash.length - 1 - i}}: ${s.message}`).join('\n');
      return { success: true, message: list || 'stash list is empty' };
    }

    return { success: false, message: `git stash: unknown subcommand ${subcmd}` };
  }

  /**
   * Implements `git remote`.
   * Supports add, remove, -v.
   */
  private remote(args: string[]): CommandResult {
    const subcmd = args[0];
    if (subcmd === 'add') {
      const name = args[1];
      const url = args[2];
      if (!name || !url) return { success: false, message: 'usage: git remote add <name> <url>' };
      this.state.remotes[name] = url;
      // このリモート用のモックサーバーを初期化
      if (!this.state.mockServers[name]) {
        this.state.mockServers[name] = { branches: {}, commits: {} };
      }
      return { success: true, message: '', newState: this.state };
    } else if (subcmd === 'remove' || subcmd === 'rm') {
      const name = args[1];
      if (this.state.remotes[name]) {
        delete this.state.remotes[name];
        return { success: true, message: '', newState: this.state };
      }
      return { success: false, message: `fatal: No such remote: '${name}'` };
    } else if (!subcmd || subcmd === '-v') {
      const list = Object.entries(this.state.remotes).map(([name, url]) => `${name}\t${url} (fetch)\n${name}\t${url} (push)`).join('\n');
      return { success: true, message: list };
    }
    return { success: false, message: `git remote: unknown subcommand ${subcmd}` };
  }

  /**
   * Implements `git push`.
   * Pushes local commits to the remote mock server.
   */
  private push(args: string[]): CommandResult {
    const remoteName = args[0] || 'origin';
    let branchName = args[1];

    // ブランチ名を決定
    if (!branchName) {
      if (this.state.HEAD.type === 'branch') {
        branchName = this.state.HEAD.value;
      } else {
        return { success: false, message: 'fatal: You are not currently on a branch.' };
      }
    }

    if (!this.state.remotes[remoteName]) {
      return { success: false, message: `fatal: '${remoteName}' does not appear to be a git repository` };
    }

    const localCommitId = this.state.branches[branchName];
    if (!localCommitId) {
       return { success: false, message: `error: src refspec ${branchName} does not match any` };
    }

    // モックサーバーへコミットを「アップロード」
    const server = this.state.mockServers[remoteName];
    
    // このブランチから到達可能なすべてのコミットを単純コピー
    let currentId: string | undefined = localCommitId;
    while (currentId && !server.commits[currentId]) {
      const commit: Commit = this.state.commits[currentId];
      if (!commit) break;
      server.commits[currentId] = { ...commit }; // Copy commit data
      currentId = commit.parents[0];
    }

    // サーバーのブランチポインタを更新
    server.branches[branchName] = localCommitId;

    // ローカルのリモート追跡ブランチを更新
    this.state.remoteBranches[`${remoteName}/${branchName}`] = localCommitId;

    return { success: true, message: `To ${this.state.remotes[remoteName]}\n   ${localCommitId.substring(0,7)}..${localCommitId.substring(0,7)}  ${branchName} -> ${branchName}`, newState: this.state };
  }

  /**
   * Implements `git fetch`.
   * Downloads commits and branches from the remote mock server.
   */
  private fetch(args: string[]): CommandResult {
    const remoteName = args[0] || 'origin';
    if (!this.state.remotes[remoteName]) {
      return { success: false, message: `fatal: '${remoteName}' does not appear to be a git repository` };
    }

    const server = this.state.mockServers[remoteName];
    if (!server) return { success: false, message: 'Internal error: mock server not found' };

    // すべてのコミットとブランチを「ダウンロード」
    let updated = false;
    for (const [branch, commitId] of Object.entries(server.branches)) {
      // 不足しているコミットでローカルのコミットデータベースを更新
      let currentId: string | undefined = commitId;
      while (currentId && !this.state.commits[currentId]) {
        const commit: Commit = server.commits[currentId];
        if (!commit) break;
        this.state.commits[currentId] = { ...commit };
        currentId = commit.parents[0];
      }

      // リモート追跡ブランチを更新
      const remoteBranchName = `${remoteName}/${branch}`;
      if (this.state.remoteBranches[remoteBranchName] !== commitId) {
        this.state.remoteBranches[remoteBranchName] = commitId;
        updated = true;
      }
    }

    return { success: true, message: updated ? 'Fetched updates' : '', newState: this.state };
  }

  /**
   * Implements `git pull`.
   * Effectively runs `git fetch` followed by a fast-forward merge (simplified).
   */
  private pull(args: string[]): CommandResult {
    const fetchResult = this.fetch(args);
    if (!fetchResult.success) return fetchResult;

    if (this.state.HEAD.type !== 'branch') {
       return { success: false, message: 'You are not currently on a branch.' };
    }
    const currentBranch = this.state.HEAD.value;
    const remoteName = args[0] || 'origin';
    const remoteBranchName = `${remoteName}/${currentBranch}`;
    
    const mergeTargetId = this.state.remoteBranches[remoteBranchName];
    if (!mergeTargetId) {
      return { success: true, message: `Already up to date. (No tracking info for ${currentBranch})`, newState: this.state };
    }

    const currentHeadId = this.state.branches[currentBranch];
    
    if (currentHeadId === mergeTargetId) {
       return { success: true, message: 'Already up to date.', newState: this.state };
    }

    // Fast-Forwardが可能か確認
    let runner: string | undefined = mergeTargetId;
    let isAncestor = false;
    while (runner) {
      if (runner === currentHeadId) {
        isAncestor = true;
        break;
      }
      runner = this.state.commits[runner]?.parents[0];
    }

    if (isAncestor || !currentHeadId) {
      // Fast-forward
      this.state.branches[currentBranch] = mergeTargetId;
      // 新しいHEADに合わせてWD/Indexを更新
      const newCommit = this.state.commits[mergeTargetId];
      this.state.index = {};
      this.state.workingDirectory = { ...newCommit.tree };
      
      return { success: true, message: `Updating ${currentHeadId ? currentHeadId.substring(0,7) : 'null'}..${mergeTargetId.substring(0,7)}\nFast-forward`, newState: this.state };
    } else {
      return { success: false, message: 'fatal: Not possible to fast-forward, aborting. (Merge logic not fully implemented yet)' };
    }
  }

  /**
   * Implements `git merge`.
   * Handles Fast-forward and 3-way merges with conflict detection.
   */
  private merge(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'fatal: No branch specified' };
    }

    const targetBranchName = args[0];
    const targetCommitId = this.state.branches[targetBranchName];

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

    if (mergeBaseId === currentHeadId) {
      // Fast-forwardマージ
      if (this.state.HEAD.type === 'branch') {
        this.state.branches[this.state.HEAD.value] = targetCommitId;
      } else {
        this.state.HEAD.value = targetCommitId;
      }
      
      // WD/Indexを更新
      const newCommit = this.state.commits[targetCommitId];
      this.state.index = {};
      this.state.workingDirectory = { ...newCommit.tree };
      
      return { success: true, message: `Updating ${currentHeadId.substring(0,7)}..${targetCommitId.substring(0,7)}\nFast-forward`, newState: this.state };
    } else if (mergeBaseId === targetCommitId) {
      return { success: true, message: 'Already up to date.' };
    }

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
    const newIndex: Record<string, FileChange> = {};
    const newWD: Record<string, string> = {};

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
        const conflictContent = `<<<<<<< HEAD\n${currentContent || ''}\n=======\n${targetContent || ''}\n>>>>>>> ${targetBranchName}`;
        newWD[file] = conflictContent;
        // コンフリクト時、ファイルはWDで更新されるがステージされない
      }
    }

    this.state.workingDirectory = newWD;
    
    if (hasConflict) {
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
      this.state.index = {}; // インデックスをクリーンにする
      
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
    this.state = this.createInitialState();
    return { success: true, message: 'Initialized empty Git repository', newState: this.state };
  }

  private add(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'Nothing specified, nothing added.' };
    }

    const path = args[0];
    
    if (path === '.') {
      // すべての変更をステージ
      for (const [filePath, content] of Object.entries(this.state.workingDirectory)) {
        this.state.index[filePath] = { path: filePath, status: 'staged', content };
      }
    } else {
      if (!(path in this.state.workingDirectory)) {
         return { success: false, message: `pathspec '${path}' did not match any files` };
      }
      this.state.index[path] = { path, status: 'staged', content: this.state.workingDirectory[path] };
    }

    return { success: true, message: '', newState: this.state };
  }

  private commit(args: string[]): CommandResult {
    const msgIndex = args.indexOf('-m');
    if (msgIndex === -1 || msgIndex + 1 >= args.length) {
      return { success: false, message: 'Aborting commit due to empty commit message.' };
    }
    
    let message = args.slice(msgIndex + 1).join(' ');
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1);
    }

    const stagedFiles = Object.values(this.state.index);
    if (stagedFiles.length === 0) {
      return { success: false, message: 'nothing to commit, working tree clean' };
    }

    const parentId = this.resolveHeadCommitId();
    const commitId = Math.random().toString(36).substring(2, 9);
    
    const parentCommit = parentId ? this.state.commits[parentId] : null;
    const newTree = parentCommit ? { ...parentCommit.tree } : {};
    
    stagedFiles.forEach(file => {
      if (file.content !== undefined) {
        newTree[file.path] = file.content;
      }
    });

    const newCommit: Commit = {
      id: commitId,
      message,
      parents: parentId ? [parentId] : [],
      timestamp: Date.now(),
      author: 'User',
      changes: stagedFiles,
      tree: newTree
    };

    this.state.commits[commitId] = newCommit;
    
    if (this.state.HEAD.type === 'branch') {
      const branchName = this.state.HEAD.value;
      this.state.branches[branchName] = commitId;
    } else {
      this.state.HEAD.value = commitId;
      this.state.detachedHead = true;
    }

    // Update index: mark staged files as unmodified, keep them in index
    // In a real git, index matches the commit tree.
    // We should keep all files that are in the new tree in the index.
    this.state.index = {};
    for (const [path, content] of Object.entries(newTree)) {
      this.state.index[path] = { path, status: 'unmodified', content };
    }

    return { 
      success: true, 
      message: `[${this.state.HEAD.type === 'branch' ? this.state.HEAD.value : 'detached'}] ${message}`, 
      newState: this.state 
    };
  }

  private status(): CommandResult {
    const staged = Object.keys(this.state.index);
    const untracked = Object.keys(this.state.workingDirectory).filter(f => !this.state.index[f] && !this.isFileInHead(f));
    
    let output = '';
    if (this.state.HEAD.type === 'branch') {
      output += `On branch ${this.state.HEAD.value}\n`;
    } else {
      output += `HEAD detached at ${this.state.HEAD.value}\n`;
    }

    if (staged.length === 0 && untracked.length === 0) {
      output += 'nothing to commit, working tree clean';
    } else {
      if (staged.length > 0) {
        output += 'Changes to be committed:\n' + staged.map(f => `  ${f}`).join('\n') + '\n';
      }
      if (untracked.length > 0) {
        output += 'Untracked files:\n' + untracked.map(f => `  ${f}`).join('\n');
      }
    }

    return { success: true, message: output };
  }

  private log(): CommandResult {
    let currentCommitId = this.resolveHeadCommitId();
    if (!currentCommitId) {
      return { success: false, message: "fatal: your current branch 'main' does not have any commits yet" };
    }

    let output = '';
    while (currentCommitId) {
      const commit: Commit = this.state.commits[currentCommitId];
      if (!commit) break;
      output += `commit ${commit.id}\nAuthor: ${commit.author}\nDate: ${new Date(commit.timestamp).toISOString()}\n\n    ${commit.message}\n\n`;
      currentCommitId = commit.parents[0];
    }

    return { success: true, message: output.trim() };
  }

  private isFileInHead(path: string): boolean {
    const headId = this.resolveHeadCommitId();
    if (!headId) return false;
    return !!this.state.commits[headId].tree[path];
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
    this.state.workingDirectory[filename] = content;
  }

  private branch(args: string[]): CommandResult {
    if (args.length === 0) {
      const current = this.state.HEAD.type === 'branch' ? this.state.HEAD.value : '';
      const list = Object.keys(this.state.branches).map(b => 
        (b === current ? '* ' : '  ') + b
      ).join('\n');
      return { success: true, message: list };
    }

    const branchName = args[0];
    if (this.state.branches[branchName]) {
      return { success: false, message: `fatal: A branch named '${branchName}' already exists.` };
    }

    const headId = this.resolveHeadCommitId();
    if (!headId) {
      return { success: false, message: 'fatal: Not a valid object name: \'master\'.' };
    }

    this.state.branches[branchName] = headId;
    return { success: true, message: '', newState: this.state };
  }

  private checkout(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'checkout: missing argument' };
    }

    let target = args[0];
    let createBranch = false;

    if (target === '-b') {
      createBranch = true;
      target = args[1];
    }

    if (createBranch) {
      const branchRes = this.branch([target]);
      if (!branchRes.success) return branchRes;
    }

    // Switch to branch
    if (this.state.branches[target]) {
      this.state.HEAD = { type: 'branch', value: target };
      
      // Update WD/Index to match new HEAD (simplified: just reset index, keep WD changes if safe? 
      // For this sim, let's just load the tree of the commit)
      const commitId = this.state.branches[target];
      const commit = this.state.commits[commitId];
      if (commit) {
        this.state.index = {};
        this.state.workingDirectory = { ...commit.tree };
      }
      
      return { success: true, message: `Switched to branch '${target}'`, newState: this.state };
    }

    // Detached HEAD (commit ID)
    if (this.state.commits[target]) {
      this.state.HEAD = { type: 'commit', value: target };
      const commit = this.state.commits[target];
      this.state.index = {};
      this.state.workingDirectory = { ...commit.tree };
      return { success: true, message: `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state.`, newState: this.state };
    }

    return { success: false, message: `error: pathspec '${target}' did not match any file(s) known to git` };
  }
  /**
   * Implements `git diff`.
   */
  private diff(args: string[]): CommandResult {
    const isCached = args.includes('--cached') || args.includes('--staged');
    let output = '';

    if (isCached) {
      // Index vs HEAD
      const headId = this.resolveHeadCommitId();
      if (!headId) {
        // No commits yet, compare index to empty
        // Basically everything in index is an addition
        for (const [path, fileChange] of Object.entries(this.state.index)) {
          const content = fileChange.content || '';
          output += generateDiff(path, '', content);
        }
      } else {
        const headCommit = this.state.commits[headId];
        const headTree = headCommit.tree;

        // Files in Index
        for (const [path, fileChange] of Object.entries(this.state.index)) {
          const indexContent = fileChange.content || '';
          const headContent = headTree[path] || '';
          if (indexContent !== headContent) {
            output += generateDiff(path, headContent, indexContent);
          }
        }

        // Files in HEAD but not in Index (deleted)
        for (const [path, headContent] of Object.entries(headTree)) {
          if (this.state.index[path] === undefined) {
             output += generateDiff(path, headContent, '');
          }
        }
      }
    } else {
      // Working Directory vs Index
      // Only tracked files (in index) are considered for diff
      for (const [path, fileChange] of Object.entries(this.state.index)) {
        const indexContent = fileChange.content || '';
        const workContent = this.state.workingDirectory[path];
        
        // If file is missing in working directory but present in index -> deleted
        if (workContent === undefined) {
          output += generateDiff(path, indexContent, '');
        } else if (workContent !== indexContent) {
          // Modified
          output += generateDiff(path, indexContent, workContent);
        }
      }
    }


    return { success: true, message: output };
  }

  /**
   * Implements `git rebase`.
   * Simplified version: Replays commits from current branch onto target branch.
   */
  private rebase(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'fatal: No branch specified' };
    }

    const targetBranchName = args[0];
    const targetCommitId = this.state.branches[targetBranchName];

    if (!targetCommitId) {
      return { success: false, message: `fatal: '${targetBranchName}' does not point to a valid commit` };
    }

    const currentHeadId = this.resolveHeadCommitId();
    if (!currentHeadId) {
      return { success: false, message: 'fatal: You are not currently on a branch.' };
    }
    
    if (this.state.HEAD.type !== 'branch') {
       return { success: false, message: 'fatal: You must be on a branch to rebase.' };
    }

    if (currentHeadId === targetCommitId) {
      return { success: true, message: 'Current branch is up to date.' };
    }

    // 1. Find merge base
    const mergeBaseId = this.findMergeBase(currentHeadId, targetCommitId);
    if (!mergeBaseId) {
      return { success: false, message: 'fatal: refusing to rebase unrelated histories' };
    }
    
    if (mergeBaseId === currentHeadId) {
       // Current is ancestor of target -> Fast-forward (just update pointer)
       this.state.branches[this.state.HEAD.value] = targetCommitId;
       const newCommit = this.state.commits[targetCommitId];
       this.state.workingDirectory = { ...newCommit.tree };
       this.state.index = {};
       for (const [path, content] of Object.entries(newCommit.tree)) {
         this.state.index[path] = { path, status: 'unmodified', content };
       }
       return { success: true, message: `Fast-forwarded ${this.state.HEAD.value} to ${targetBranchName}`, newState: this.state };
    }

    if (mergeBaseId === targetCommitId) {
      return { success: true, message: 'Current branch is already up to date with target.' };
    }

    // 2. Collect commits to rebase (from mergeBase (exclusive) to currentHead (inclusive))
    const commitsToReplay: Commit[] = [];
    let ptr: string | null = currentHeadId;
    while (ptr && ptr !== mergeBaseId) {
      const commit: Commit = this.state.commits[ptr];
      commitsToReplay.unshift(commit); // Add to front to reverse order
      ptr = commit.parents[0]; // Assuming linear history for simplicity
    }

    // 3. Reset HEAD to target
    let newBaseId = targetCommitId;
    
    // 4. Replay commits
    for (const commit of commitsToReplay) {
      const originalParentId = commit.parents[0];
      const originalParent = this.state.commits[originalParentId];
      
      // Perform 3-way merge logic for each commit
      const mergeResult = this.performThreeWayMerge(originalParent, this.state.commits[newBaseId], commit);
      
      if (mergeResult.hasConflict) {
        return { success: false, message: `Conflict detected while replaying commit ${commit.id.substring(0,7)}. Rebase aborted.` };
      }

      // Create new commit
      const newCommitId = Math.random().toString(36).substring(2, 9);
      const newCommit: Commit = {
        ...commit,
        id: newCommitId,
        parents: [newBaseId],
        timestamp: Date.now(),
        tree: mergeResult.tree
      };
      
      this.state.commits[newCommitId] = newCommit;
      newBaseId = newCommitId;
    }

    // 5. Update branch pointer
    this.state.branches[this.state.HEAD.value] = newBaseId;
    
    // Update WD/Index
    const finalCommit = this.state.commits[newBaseId];
    this.state.workingDirectory = { ...finalCommit.tree };
    this.state.index = {};
    for (const [path, content] of Object.entries(finalCommit.tree)) {
      this.state.index[path] = { path, status: 'unmodified', content };
    }

    return { success: true, message: `Successfully rebased and updated ${this.state.HEAD.value}.`, newState: this.state };
  }

  /**
   * Implements `git cherry-pick`.
   * Applies changes from a specific commit onto the current HEAD.
   */
  private cherryPick(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'fatal: No commit specified' };
    }

    const commitId = args[0];
    const commit = this.state.commits[commitId];

    if (!commit) {
      return { success: false, message: `fatal: '${commitId}' is not a valid commit` };
    }

    const currentHeadId = this.resolveHeadCommitId();
    if (!currentHeadId) {
      return { success: false, message: 'fatal: You are not currently on a branch.' };
    }

    // Get parent of the commit we're cherry-picking
    if (commit.parents.length === 0) {
      return { success: false, message: 'fatal: Cannot cherry-pick a root commit' };
    }

    const parentCommitId = commit.parents[0];
    const parentCommit = this.state.commits[parentCommitId];
    const currentCommit = this.state.commits[currentHeadId];

    // 3-way merge: parent (base), current HEAD (ours), commit (theirs)
    const mergeResult = this.performThreeWayMerge(parentCommit, currentCommit, commit);

    if (mergeResult.hasConflict) {
      // Apply conflict to working directory
      this.state.workingDirectory = mergeResult.tree;
      return { success: false, message: `Conflict detected while cherry-picking ${commitId.substring(0,7)}. Fix conflicts and commit.`, newState: this.state };
    }

    // Create new commit
    const newCommitId = Math.random().toString(36).substring(2, 9);
    const newCommit: Commit = {
      id: newCommitId,
      message: commit.message,
      parents: [currentHeadId],
      timestamp: Date.now(),
      author: commit.author,
      changes: Object.entries(mergeResult.tree).map(([path, content]) => ({
        path,
        status: 'staged' as const,
        content
      })),
      tree: mergeResult.tree
    };

    this.state.commits[newCommitId] = newCommit;

    // Update branch pointer
    if (this.state.HEAD.type === 'branch') {
      this.state.branches[this.state.HEAD.value] = newCommitId;
    } else {
      this.state.HEAD.value = newCommitId;
    }

    // Update WD/Index
    this.state.workingDirectory = { ...mergeResult.tree };
    this.state.index = {};
    for (const [path, content] of Object.entries(mergeResult.tree)) {
      this.state.index[path] = { path, status: 'unmodified', content };
    }

    return { success: true, message: `[${this.state.HEAD.type === 'branch' ? this.state.HEAD.value : 'detached'}] ${commit.message}`, newState: this.state };
  }

  /**
   * Implements `git revert`.
   * Creates a new commit that undoes changes from a specific commit.
   */
  private revert(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'fatal: No commit specified' };
    }

    const commitId = args[0];
    const commit = this.state.commits[commitId];

    if (!commit) {
      return { success: false, message: `fatal: '${commitId}' is not a valid commit` };
    }

    const currentHeadId = this.resolveHeadCommitId();
    if (!currentHeadId) {
      return { success: false, message: 'fatal: You are not currently on a branch.' };
    }

    // Get parent of the commit we're reverting
    if (commit.parents.length === 0) {
      return { success: false, message: 'fatal: Cannot revert a root commit' };
    }

    const parentCommitId = commit.parents[0];
    const parentCommit = this.state.commits[parentCommitId];
    const currentCommit = this.state.commits[currentHeadId];

    // 3-way merge to apply reverse: commit (base), current HEAD (ours), parent (theirs)
    // This effectively undoes the changes from commit
    const mergeResult = this.performThreeWayMerge(commit, currentCommit, parentCommit);

    if (mergeResult.hasConflict) {
      // Apply conflict to working directory
      this.state.workingDirectory = mergeResult.tree;
      return { success: false, message: `Conflict detected while reverting ${commitId.substring(0,7)}. Fix conflicts and commit.`, newState: this.state };
    }

    // Create new commit with revert message
    const newCommitId = Math.random().toString(36).substring(2, 9);
    const revertMessage = `Revert "${commit.message}"`;
    const newCommit: Commit = {
      id: newCommitId,
      message: revertMessage,
      parents: [currentHeadId],
      timestamp: Date.now(),
      author: 'User',
      changes: Object.entries(mergeResult.tree).map(([path, content]) => ({
        path,
        status: 'staged' as const,
        content
      })),
      tree: mergeResult.tree
    };

    this.state.commits[newCommitId] = newCommit;

    // Update branch pointer
    if (this.state.HEAD.type === 'branch') {
      this.state.branches[this.state.HEAD.value] = newCommitId;
    } else {
      this.state.HEAD.value = newCommitId;
    }

    // Update WD/Index
    this.state.workingDirectory = { ...mergeResult.tree };
    this.state.index = {};
    for (const [path, content] of Object.entries(mergeResult.tree)) {
      this.state.index[path] = { path, status: 'unmodified', content };
    }

    return { success: true, message: `[${this.state.HEAD.type === 'branch' ? this.state.HEAD.value : 'detached'}] ${revertMessage}`, newState: this.state };
  }

  /**
   * Helper for 3-way merge logic.
   * Returns the new tree and conflict status.
   */
  private performThreeWayMerge(base: Commit, ours: Commit, theirs: Commit): { tree: Record<string, string>, hasConflict: boolean } {
    const allFiles = new Set([
      ...Object.keys(base.tree),
      ...Object.keys(ours.tree),
      ...Object.keys(theirs.tree)
    ]);

    const newTree: Record<string, string> = {};
    let hasConflict = false;

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
        // Simplified conflict content
        newTree[file] = `<<<<<<< HEAD\n${oursContent || ''}\n=======\n${theirsContent || ''}\n>>>>>>> ${theirs.id.substring(0,7)}`;
      }
    }
    return { tree: newTree, hasConflict };
  }
}
