import type { Commit, GitState, Scenario } from '@/types/git';

const c1: Commit = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': 'Base', 'notes.md': 'Keep' } };
const c2: Commit = { ...c1, id: 'c2', message: 'Accidental change', parents: ['c1'], tree: { ...c1.tree, 'app.ts': 'Fixed' } };
const c3: Commit = { ...c2, id: 'c3', message: 'Address review', parents: ['c2'], tree: { ...c1.tree, 'app.ts': 'Reviewed fix' } };
const base: GitState = { commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' }, index: {}, workingDirectory: c1.tree, detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {} };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, goal: Scenario['goal'], solution: string[]): Scenario => ({
  id, title, description, category: '誤操作からの復旧', difficulty: 'intermediate', initialState: structuredClone({ ...base, ...overrides }), goal, solution, hints: solution,
});

export const mistakeScenarios: Scenario[] = [
  lesson('mistake-stale-index', '修正したのに古い内容が記録される', 'app.tsはDraftをstageした後、Fixedへ再編集されています。notes.mdのKeepを保ち、Fixedをコミットして追跡ファイルをクリーンにしてください。最初に三つの領域の違いを調べましょう。',
    { index: { 'app.ts': { path: 'app.ts', status: 'staged', content: 'Draft' } }, workingDirectory: { ...c1.tree, 'app.ts': 'Fixed' } },
    { type: 'state_matches', params: { tree: { 'app.ts': 'Fixed', 'notes.md': 'Keep' }, working: { 'app.ts': 'Fixed' }, clean: true } },
    ['git status', 'git diff', 'git diff --staged', 'git add app.ts', 'git commit -m "Fix application"']),
  lesson('mistake-wrong-branch', 'mainへ誤って記録した変更を移す', '共有前のmainにAccidental changeを記録しました。本来の作業先featureにそのコミットを保護し、mainをc1へ戻してfeatureへ移動してください。共有済みmainの書き換えを練習する課題ではありません。',
    { commits: { c1, c2 }, branches: { main: 'c2', feature: 'c1' }, workingDirectory: c2.tree },
    { type: 'state_matches', params: { branch: 'feature', head: 'c2', branches: { main: 'c1', feature: 'c2' }, tree: { 'app.ts': 'Fixed', 'notes.md': 'Keep' }, clean: true } },
    ['git log --oneline --all', 'git switch feature', 'git merge main', 'git switch main', 'git reset --hard c1', 'git switch feature']),
  lesson('mistake-stale-approval', '成功表示なのにPRをマージできない', '【GitHub模擬環境】PR #1は修正済みc3ですが、承認とCI成功は古いc2の記録です。現在の状態を調べ、修正済みの内容をmainへ取り込んでください。simulateはこのアプリ専用です。',
    { commits: { c1, c2, c3 }, branches: { main: 'c1', feature: 'c3' }, HEAD: { type: 'branch', value: 'feature' }, workingDirectory: c3.tree, remotes: { origin: 'mock://team/project' }, remoteBranches: { 'origin/main': 'c1', 'origin/feature': 'c3' }, mockServers: { origin: { commits: { c1, c2, c3 }, branches: { main: 'c1', feature: 'c3' } } }, github: { requireReview: true, requireCI: true, pullRequests: { 1: { number: 1, title: 'Fix', body: '修正と確認', base: 'main', head: 'feature', headCommit: 'c2', status: 'open', review: { commitId: 'c2', result: 'approved', body: '旧版を確認' }, checks: { commitId: 'c2', status: 'success' } } } } },
    { type: 'github_state', params: { status: 'merged', review: 'approved', checks: 'success', tree: { 'app.ts': 'Reviewed fix', 'notes.md': 'Keep' } } },
    ['gh pr view 1', 'gh pr checks 1', 'simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge']),
];
