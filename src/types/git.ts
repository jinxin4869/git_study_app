export type FileStatus = 'unmodified' | 'modified' | 'staged' | 'deleted';

export interface File {
  path: string;
  content: string;
}

export interface FileChange {
  path: string;
  status: FileStatus;
  content?: string; // For simplicity, we might just store the new content
}

export interface Commit {
  id: string;
  message: string;
  parents: string[];
  timestamp: number;
  author: string;
  changes: FileChange[];
  tree: Record<string, string>; // Snapshot of files at this commit (path -> content)
}

export interface Branch {
  name: string;
  commitId: string | null; // null if branch exists but has no commits (e.g. after init before first commit? actually usually points to nothing or we handle it specially)
}

export interface GitState {
  /** Paths whose actual merge/replay/stash conflicts still need staging. Not inferred from text. */
  unmergedPaths?: string[];
  patchSession?: { path: string; chunks: { before: string; after: string; changed: boolean; selected?: boolean }[]; cursor: number };
  worktrees?: Record<string, { branch: string; workingDirectory: Record<string, string>; index: Record<string, FileChange> }>;
  activeWorktree?: string;
  submodules?: Record<string, { url: string; commitId: string; initialized: boolean }>;
  lfs?: { installed: boolean; patterns: string[] };
  sparseCheckout?: string[];
  bisect?: { original: GitState; good?: string; bad?: string; found?: string };
  lastBisectFound?: string;
  operation?: {
    kind: 'rebase' | 'cherry-pick' | 'revert';
    original: GitState;
    remaining: string[];
    current?: { id: string; message: string; committed?: boolean; amend?: boolean };
    todo?: string;
    awaiting?: 'todo' | 'edit' | 'reword';
    actions?: Record<string, 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop'>;
  };
  config?: Record<string, string>;
  upstreams?: Record<string, string>;
  tags?: Record<string, { commitId: string; message?: string }>;
  reflog?: { id: string; command: string }[];
  github?: {
    requireReview: boolean;
    requireCI: boolean;
    pullRequests: Record<number, {
      number: number; title: string; body: string; base: string; head: string;
      headCommit: string; status: 'open' | 'merged' | 'closed';
      review?: { commitId: string; result: 'approved' | 'changes_requested'; body: string };
      checks?: { commitId: string; status: 'success' | 'failure' };
    }>;
  };
  commits: Record<string, Commit>;
  branches: Record<string, string>; // branch name -> commit id
  HEAD: {
    type: 'branch' | 'commit';
    value: string; // branch name or commit id
  };
  index: Record<string, FileChange>; // Staging area
  workingDirectory: Record<string, string>; // Current file contents
  detachedHead: boolean;
  pendingMerge?: { targetId: string; workingDirectory: Record<string, string>; index: Record<string, FileChange> };
  stash: {
    id: string;
    message: string;
    index: Record<string, FileChange>;
    workingDirectory: Record<string, string>;
    timestamp: number;
    baseTree?: Record<string, string>;
  }[];
  remotes: Record<string, string>; // name -> url
  remoteBranches: Record<string, string>; // 'origin/main' -> commitId
  mockServers: Record<string, { // Simulated remote repositories
    branches: Record<string, string>;
    commits: Record<string, Commit>;
    tags?: Record<string, { commitId: string; message?: string }>;
  }>;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category?: string;
  solution?: string[];
  expectedFailures?: string[];
  initialState?: GitState; // If undefined, start with empty init
  goal: {
    type: 'commit_count' | 'branch_exists' | 'merge_complete' | 'clean_working_tree' | 
          'repo_initialized' | 'file_exists' | 'command_executed' | 'file_staged' | 
          'file_modified' | 'file_committed' | 'file_missing' | 'stash_count' |
          'state_matches' | 'conflict_present' | 'conflict_resolved' | 'github_state';
    params?: Record<string, unknown>;
  };
  hints: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  newState?: GitState;
}
