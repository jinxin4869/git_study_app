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
  commits: Record<string, Commit>;
  branches: Record<string, string>; // branch name -> commit id
  HEAD: {
    type: 'branch' | 'commit';
    value: string; // branch name or commit id
  };
  index: Record<string, FileChange>; // Staging area
  workingDirectory: Record<string, string>; // Current file contents
  detachedHead: boolean;
  stash: {
    id: string;
    message: string;
    index: Record<string, FileChange>;
    workingDirectory: Record<string, string>;
    timestamp: number;
  }[];
  remotes: Record<string, string>; // name -> url
  remoteBranches: Record<string, string>; // 'origin/main' -> commitId
  mockServers: Record<string, { // Simulated remote repositories
    branches: Record<string, string>;
    commits: Record<string, Commit>;
  }>;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  initialState?: GitState; // If undefined, start with empty init
  goal: {
    type: 'commit_count' | 'branch_exists' | 'merge_complete' | 'clean_working_tree' | 
          'repo_initialized' | 'file_exists' | 'command_executed' | 'file_staged' | 
          'file_modified' | 'file_committed' | 'file_missing' | 'stash_count';
    params?: Record<string, unknown>;
  };
  hints: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  newState?: GitState;
}
