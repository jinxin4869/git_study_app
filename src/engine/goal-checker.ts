import { GitState, Scenario } from '@/types/git';
import { headTree, indexTree, cleanTrackedFiles, normalizeCommand } from './git-state';

/**
 * Checks if the current state meets the scenario goal.
 */
export const checkGoal = (currentState: GitState, scenario: Scenario, lastCommand?: string): boolean => {
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
