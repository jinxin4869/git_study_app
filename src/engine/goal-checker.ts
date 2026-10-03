import { CommandResult, GitState, Scenario } from '@/types/git';
import { headTree, indexTree, cleanTrackedFiles, normalizeCommand } from './git-state';

/**
 * Checks if the current state meets the scenario goal.
 */
const matchesGoal = (currentState: GitState, scenario: Scenario, lastCommand?: string): boolean => {
  const goal = scenario.goal;
  if (goal.type === 'github_state') {
    const expected = goal.params ?? {};
    if (expected.command && (!lastCommand || normalizeCommand(lastCommand) !== normalizeCommand(expected.command as string))) return false;
    const pr = currentState.github?.pullRequests[(expected.number as number) ?? 1];
    if (!pr) return false;
    const latest = currentState.mockServers.origin?.branches[pr.head];
    if (expected.status && pr.status !== expected.status) return false;
    if (expected.review && (pr.review?.commitId !== latest || pr.review.result !== expected.review)) return false;
    if (expected.checks && (pr.checks?.commitId !== latest || pr.checks.status !== expected.checks)) return false;
    if (expected.title && pr.title !== expected.title) return false;
    if (expected.headBranch && pr.head !== expected.headBranch) return false;
    if (expected.baseBranch && pr.base !== expected.baseBranch) return false;
    if (expected.bodyNonEmpty && !pr.body.trim()) return false;
    if (expected.tree) {
      const tree = currentState.mockServers.origin?.commits[currentState.mockServers.origin.branches[pr.base]]?.tree;
      if (!tree || Object.entries(expected.tree as Record<string, string>).some(([path, content]) => tree[path] !== content)) return false;
    }
    return true;
  }
  if (goal.type === 'state_matches') {
    const expected = goal.params ?? {};
    if (expected.command && (!lastCommand || normalizeCommand(lastCommand) !== normalizeCommand(expected.command as string))) return false;
    if (expected.operation === null && currentState.operation) return false;
    if (typeof expected.operation === 'string' && currentState.operation?.kind !== expected.operation) return false;
    if (expected.bisectActive !== undefined && !!currentState.bisect !== expected.bisectActive) return false;
    if (expected.bisectFound && (currentState.bisect?.found ?? currentState.lastBisectFound) !== expected.bisectFound) return false;
    if (expected.sparseCheckout !== undefined && JSON.stringify(currentState.sparseCheckout ?? null) !== JSON.stringify(expected.sparseCheckout)) return false;
    if (expected.lfsInstalled !== undefined && currentState.lfs?.installed !== expected.lfsInstalled) return false;
    if (expected.lfsPatterns && JSON.stringify(currentState.lfs?.patterns) !== JSON.stringify(expected.lfsPatterns)) return false;
    if (expected.worktrees) {
      for (const [path, branch] of Object.entries(expected.worktrees as Record<string, string | null>)) {
        if (branch === null ? currentState.worktrees?.[path] !== undefined : currentState.worktrees?.[path]?.branch !== branch) return false;
      }
    }
    if (expected.worktreeWorking) {
      for (const [path, files] of Object.entries(expected.worktreeWorking as Record<string, Record<string, string>>)) {
        if (Object.entries(files).some(([file, content]) => currentState.worktrees?.[path]?.workingDirectory[file] !== content)) return false;
      }
    }
    if (expected.submodules) {
      for (const [path, fields] of Object.entries(expected.submodules as Record<string, { commitId?: string; initialized?: boolean }>)) {
        const submodule = currentState.submodules?.[path];
        if (!submodule || (fields.commitId !== undefined && submodule.commitId !== fields.commitId) || (fields.initialized !== undefined && submodule.initialized !== fields.initialized)) return false;
      }
    }
    const id = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
    const commit = currentState.commits[id];
    if (expected.detached !== undefined && (currentState.HEAD.type === 'commit') !== expected.detached) return false;
    if (expected.workingPresent && (expected.workingPresent as string[]).some(path => currentState.workingDirectory[path] === undefined)) return false;
    if (expected.committedFiles && (expected.committedFiles as string[]).some(path => commit?.tree[path] === undefined)) return false;
    if (expected.commitCount !== undefined) {
      let cursor = id;
      const visited = new Set<string>();
      while (cursor && currentState.commits[cursor] && !visited.has(cursor)) {
        visited.add(cursor);
        cursor = currentState.commits[cursor].parents[0];
      }
      if (visited.size < Number(expected.commitCount)) return false;
    }
    if (expected.historyTrees) {
      let cursor = id;
      for (const files of expected.historyTrees as Record<string, string | null>[]) {
        const item = currentState.commits[cursor];
        if (!item || Object.entries(files).some(([path, content]) => content === null ? item.tree[path] !== undefined : item.tree[path] !== content)) return false;
        cursor = item.parents[0];
      }
    }
    if (expected.acceptedTreeContents && Object.entries(expected.acceptedTreeContents as Record<string, string[]>).some(([path, accepted]) => {
      const content = commit?.tree[path];
      return content === undefined || !accepted.some(value => value.trim() === content.trim());
    })) return false;
    if (expected.head !== undefined && id !== expected.head) return false;
    if (expected.branch !== undefined && (currentState.HEAD.type !== 'branch' || currentState.HEAD.value !== expected.branch)) return false;
    if (expected.message !== undefined && commit?.message !== expected.message) return false;
    if (expected.parents !== undefined && JSON.stringify(commit?.parents) !== JSON.stringify(expected.parents)) return false;
    if (expected.historyMessages) {
      let cursor = id;
      for (const message of expected.historyMessages as string[]) {
        const item = currentState.commits[cursor];
        if (!item || item.message !== message) return false;
        cursor = item.parents[0];
      }
    }
    if (expected.clean && !cleanTrackedFiles(currentState)) return false;
    if (expected.stashCount !== undefined && currentState.stash.length !== expected.stashCount) return false;
    const referenceMaps: Record<string, Record<string, string>> = {
      branches: currentState.branches, remoteBranches: currentState.remoteBranches,
      remotes: currentState.remotes, upstreams: currentState.upstreams ?? {}, config: currentState.config ?? {},
      tags: Object.fromEntries(Object.entries(currentState.tags ?? {}).map(([name, tag]) => [name, tag.commitId])),
      serverBranches: currentState.mockServers.origin?.branches ?? {}
    };
    for (const [key, actual] of Object.entries(referenceMaps)) {
      const entries = expected[key] as Record<string, string | null> | undefined;
      if (entries && Object.entries(entries).some(([name, value]) => value === null ? actual[name] !== undefined : actual[name] !== value)) return false;
    }
    if (expected.remoteTree) {
      const server = currentState.mockServers.origin;
      const tree = server?.commits[server.branches[(expected.remoteBranch as string) ?? 'main']]?.tree;
      if (!tree || Object.entries(expected.remoteTree as Record<string, string>).some(([path, content]) => tree[path] !== content)) return false;
    }
    if (expected.tagMessages && Object.entries(expected.tagMessages as Record<string, string>).some(([name, message]) => currentState.tags?.[name]?.message !== message)) return false;
    if (expected.tagBranches && Object.entries(expected.tagBranches as Record<string, string>).some(([tag, branch]) => currentState.tags?.[tag]?.commitId !== currentState.branches[branch])) return false;
    if (expected.serverTagBranches && Object.entries(expected.serverTagBranches as Record<string, string>).some(([tag, branch]) => currentState.mockServers.origin?.tags?.[tag]?.commitId !== currentState.branches[branch])) return false;
    if (expected.branchTrees) {
      for (const [branch, files] of Object.entries(expected.branchTrees as Record<string, Record<string, string>>)) {
        const tree = currentState.commits[currentState.branches[branch]]?.tree;
        if (!tree || Object.entries(files).some(([path, content]) => tree[path] !== content)) return false;
      }
    }
    if (expected.missingCommitted && commit?.tree[expected.missingCommitted as string] !== undefined) return false;
    for (const [key, actual] of [['tree', headTree(currentState)], ['working', currentState.workingDirectory], ['index', indexTree(currentState)]] as const) {
      const entries = expected[key] as Record<string, string | null> | undefined;
      if (entries && Object.entries(entries).some(([path, content]) => content === null ? actual[path] !== undefined : actual[path] !== content)) return false;
    }
    return true;
  }
  if (goal.type === 'conflict_present') return Object.values(currentState.workingDirectory).some(content => content.includes('<<<<<<< HEAD'));
  if (goal.type === 'conflict_resolved') {
    const content = currentState.workingDirectory[goal.params?.name as string];
    const accepted = goal.params?.acceptedContents;
    return content !== undefined && Array.isArray(accepted) &&
      accepted.some(expected => typeof expected === 'string' && content.trim() === expected.trim()) &&
      !Object.values(currentState.workingDirectory).some(text => /^(<<<<<<<|=======|>>>>>>>)/m.test(text));
  }
  
  if (goal.type === 'repo_initialized') {
      return !!lastCommand && normalizeCommand(lastCommand) === 'init';
  }
  if (goal.type === 'file_exists') {
      const name = goal.params?.name as string;
      return name ? currentState.workingDirectory[name] !== undefined : false;
  }
  if (goal.type === 'command_executed') {
      const command = goal.params?.command as string;
      if (!command || !lastCommand) return false;
      const actual = normalizeCommand(lastCommand);
      const expected = normalizeCommand(command);
      return actual === expected || actual.startsWith(expected + ' ');
  }
  if (goal.type === 'file_staged') {
      const name = goal.params?.name as string;
      return !!name && indexTree(currentState)[name] !== headTree(currentState)[name];
  }
  if (goal.type === 'file_modified') {
      const file = goal.params?.name as string;
      if (!file) return false;
      const wdContent = currentState.workingDirectory[file];
      if (wdContent === undefined) return false;
      
      const headId = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
      const headCommit = currentState.commits[headId];
      const headContent = headCommit?.tree[file] || '';
      
      return wdContent !== headContent;
  }
  if (goal.type === 'file_committed') {
      const file = goal.params?.name as string;
      if (!file) return false;
      const headId = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
      const headCommit = currentState.commits[headId];
      return !!(headCommit && headCommit.tree[file] !== undefined);
  }
  if (goal.type === 'file_missing') {
      const name = goal.params?.name as string;
      return name ? currentState.workingDirectory[name] === undefined : false;
  }

  if (scenario.goal.type === 'commit_count') {
    let id = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
    let count = 0;
    const visited = new Set<string>();
    while (id && currentState.commits[id] && !visited.has(id)) {
      visited.add(id);
      count++;
      id = currentState.commits[id].parents[0];
    }
    return count >= ((scenario.goal.params?.count as number) || 0);
  }
  if (scenario.goal.type === 'branch_exists') {
    if (scenario.goal.params?.check_detached) {
      return currentState.detachedHead;
    }
    const branchName = scenario.goal.params?.name as string;
    const checkedOut = !!scenario.goal.params?.checkedOut;
    if (!branchName) return false;
    
    const exists = currentState.branches[branchName] !== undefined;
    const isCheckedOut = currentState.HEAD.type === 'branch' && currentState.HEAD.value === branchName;
    return exists && (!checkedOut || isCheckedOut);
  }
  if (scenario.goal.type === 'merge_complete') {
     if (goal.params?.mergedCommit) return currentState.branches[goal.params.branch as string] === goal.params.mergedCommit;
     const headId = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
     if (!headId) return false;
     const headCommit = currentState.commits[headId];
     return !!(headCommit && headCommit.parents.length > 1);
  }
  if (goal.type === 'clean_working_tree') {
      return cleanTrackedFiles(currentState);
  }
  if (goal.type === 'stash_count') {
      const count = goal.params?.count as number;
      return count ? currentState.stash.length >= count : false;
  }

  return false;
};

export interface GoalCondition { id: string; label: string; met: boolean }
export interface GoalAssessment { met: boolean; conditions: GoalCondition[] }
const describeValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);
const fieldLabels: Record<string, string> = {
  command: '指定した操作を成功させる', operation: '進行中の履歴操作', bisectActive: 'bisectの実行状態', bisectFound: '原因コミット',
  sparseCheckout: 'sparse-checkoutの対象', lfsInstalled: 'LFSの初期化', lfsPatterns: 'LFSの対象パターン',
  worktrees: 'worktreeのブランチ（nullは削除）', worktreeWorking: 'worktreeの作業ファイル', submodules: 'submoduleの状態',
  head: 'HEADのコミット', branch: '現在のブランチ', message: '最新コミットのメッセージ', parents: '最新コミットの親と順序',
  historyMessages: 'HEADから第一親へ続くメッセージと順序', clean: 'HEAD・index・追跡ファイルに未保存の差がない（未追跡は対象外）',
  stashCount: 'stashの件数', branches: 'ローカルブランチの参照', remoteBranches: 'リモート追跡参照', remotes: '接続先URL',
  upstreams: 'upstreamの設定', config: 'Git設定', tags: 'タグの参照', serverBranches: '模擬サーバーのブランチ',
  remoteTree: '模擬サーバーのファイル内容', tagMessages: '注釈付きタグのメッセージ', tagBranches: 'タグとブランチの一致',
  serverTagBranches: '公開済みタグとローカルブランチの一致', branchTrees: '各ブランチのコミット内容', missingCommitted: 'コミットから除くファイル',
  tree: 'HEADのファイル内容（nullは不在）', working: '作業ツリーの内容（nullは不在）', index: 'indexの内容（nullは不在）',
  status: 'PRの状態', review: '最新の公開コミットに対するレビュー', checks: '最新の公開コミットに対するCI', title: 'PRのタイトル',
  headBranch: 'PRの提案元ブランチ', baseBranch: 'PRの統合先ブランチ', bodyNonEmpty: 'PRの説明が空でない',
  detached: 'Detached HEADの状態', workingPresent: '作業ツリーに存在するファイル', committedFiles: 'HEADに記録するファイル',
  commitCount: 'HEADから第一親をたどるコミット数の下限', historyTrees: 'HEADから第一親へ続く各コミットのファイル内容',
  acceptedTreeContents: 'コミットに保つ許容された解決内容'
};

/** The displayed requirements and pass/fail use the same existing state predicates. */
export const assessGoal = (state: GitState, scenario: Scenario, lastCommand?: string, result?: CommandResult): GoalAssessment => {
  const goal = scenario.goal;
  const params = goal.params ?? {};
  const conditions: GoalCondition[] = [];
  const add = (id: string, label: string, partial = goal) => conditions.push({ id, label, met: matchesGoal(state, { ...scenario, goal: partial }, lastCommand) });
  if (goal.type === 'state_matches' || goal.type === 'github_state') {
    if (goal.type === 'github_state') {
      add('pr', `模擬PR #${params.number ?? 1} が存在する`, { type: goal.type, params: { number: params.number } });
    }
    for (const [key, value] of Object.entries(params)) {
      if (key === 'number' || key === 'remoteBranch') continue; // Context for other predicates, not a requirement on its own.
      if (!Object.hasOwn(fieldLabels, key)) {
        conditions.push({ id: key, label: `教材に未対応の採点条件があります: ${key}。演習を選び直してください。`, met: false });
        continue;
      }
      const label = key === 'operation' && value === null ? '進行中の履歴操作を終了する' :
        key === 'clean' ? fieldLabels.clean : `${goal.type === 'github_state' && key === 'tree' ? '模擬PRの統合先に記録されたファイル内容' : fieldLabels[key]}: ${describeValue(value)}`;
      add(key, label, { type: goal.type, params: { [key]: value, number: params.number, remoteBranch: params.remoteBranch } });
    }
  } else {
    const name = describeValue(params.name ?? '');
    const labels: Record<Scenario['goal']['type'], string> = {
      repo_initialized: 'リポジトリの初期化を成功させる', file_exists: `作業ツリーに ${name} が存在する`,
      command_executed: `確認操作を成功させる: ${params.command ?? ''}（対応する引数を追加可能）`,
      file_staged: `${name} のindexとHEADに差がある`, file_modified: `${name} が存在し、HEADと内容が異なる`,
      file_committed: `HEADのコミットに ${name} が存在する`, file_missing: `作業ツリーに ${name} が存在しない`,
      commit_count: `HEADから第一親をたどるコミットが ${params.count ?? 0} 件以上ある`,
      branch_exists: params.check_detached ? 'Detached HEADになっている' : `ブランチ ${name} が存在する${params.checkedOut ? '、かつそのブランチにいる' : ''}`,
      merge_complete: params.mergedCommit ? `ブランチ ${params.branch} が ${params.mergedCommit} を指す` : 'HEADが複数の親を持つマージコミットである',
      clean_working_tree: fieldLabels.clean, stash_count: `stashが ${params.count ?? 0} 件以上ある`,
      conflict_present: '作業ツリーに競合が発生している',
      conflict_resolved: `${name} が許容された解決内容と一致し、すべてのファイルに競合マーカーがない`,
      state_matches: '', github_state: ''
    };
    add(goal.type, labels[goal.type]);
    if (goal.type === 'conflict_resolved') {
      const content = state.workingDirectory[params.name as string];
      conditions[0].label = `${name} に必要な解決内容を保つ（前後の空白を除いて、Current / Incoming / Bothの許容結果のいずれかと一致し、すべての競合マーカーを除く）`;
      if (content !== undefined && Array.isArray(params.acceptedContents) && !params.acceptedContents.some(expected => typeof expected === 'string' && content.trim() === expected.trim())) conditions[0].label += '。現在の内容は許容結果と異なります。ファイル全体の構造・欠けた行を確認してください';
    }
  }
  if (conditions.length === 0) add('state', '指定された状態を満たす');
  if (result && !result.success && !(goal.type === 'conflict_present' && result.newState && matchesGoal(state, scenario, lastCommand))) {
    conditions.push({ id: 'execution', label: '最後の操作を成功させる（失敗した操作では合格しません）', met: false });
  }
  return { met: conditions.every(condition => condition.met), conditions };
};

export const checkGoal = (state: GitState, scenario: Scenario, lastCommand?: string, result?: CommandResult): boolean =>
  assessGoal(state, scenario, lastCommand, result).met;
