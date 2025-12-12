import { GitState, Scenario } from '@/types/git';

/**
 * Checks if the current state meets the scenario goal.
 */
export const checkGoal = (currentState: GitState, scenario: Scenario, lastCommand?: string): boolean => {
  const goal = scenario.goal;
  
  if (goal.type === 'repo_initialized') {
      return lastCommand === 'init';
  }
  if (goal.type === 'file_exists') {
      const name = goal.params?.name as string;
      return name ? currentState.workingDirectory[name] !== undefined : false;
  }
  if (goal.type === 'command_executed') {
      const command = goal.params?.command as string;
      return command ? (lastCommand === command || (typeof lastCommand === 'string' && lastCommand.startsWith(command))) : false;
  }
  if (goal.type === 'file_staged') {
      const name = goal.params?.name as string;
      return name ? currentState.index[name] !== undefined : false;
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
    const count = Object.keys(currentState.commits).length;
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
     const headId = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
     if (!headId) return false;
     const headCommit = currentState.commits[headId];
     return !!(headCommit && headCommit.parents.length > 1);
  }
  if (goal.type === 'clean_working_tree') {
      const headId = currentState.HEAD.type === 'branch' ? currentState.branches[currentState.HEAD.value] : currentState.HEAD.value;
      const headCommit = currentState.commits[headId];
      if (!headCommit) return false;
      
      const wdFiles = Object.keys(currentState.workingDirectory);
      
      for (const file of wdFiles) {
          if (currentState.workingDirectory[file] !== (headCommit.tree[file] || '')) {
               if (headCommit.tree[file] !== undefined) {
                   return false;
               }
          }
      }
      return true;
  }
  if (goal.type === 'stash_count') {
      const count = goal.params?.count as number;
      return count ? currentState.stash.length >= count : false;
  }

  return false;
};
