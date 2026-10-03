import { GitState, Scenario } from '@/types/git';

const c1 = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': 'version 1' } };
const c2 = { ...c1, id: 'c2', message: 'Add login', parents: ['c1'], tree: { 'app.ts': 'version 2' } };
const base: GitState = {
  commits: { c1, c2 }, branches: { main: 'c1', 'feature/login': 'c2' },
  HEAD: { type: 'branch', value: 'feature/login' }, index: {}, workingDirectory: c2.tree,
  detachedHead: false, stash: [], remotes: { origin: 'mock://team/project' },
  remoteBranches: { 'origin/main': 'c1', 'origin/feature/login': 'c2' },
  mockServers: { origin: { commits: { c1, c2 }, branches: { main: 'c1', 'feature/login': 'c2' } } },
  github: { requireReview: true, requireCI: true, pullRequests: {} }
};
const pullRequest = { number: 1, title: 'Add login', body: 'ログイン機能とテストを追加', head: 'feature/login', base: 'main', headCommit: 'c2', status: 'open' as const };
const exercise = (id: string, title: string, description: string, openPR: boolean, goal: Scenario['goal'], solution: string[]): Scenario => {
  const initialState: GitState = JSON.parse(JSON.stringify(base));
  if (openPR) initialState.github!.pullRequests[1] = { ...pullRequest };
  return { id, title, description: '【GitHub模擬環境】' + description, category: 'GitHub・PR・レビュー・CI', difficulty: 'advanced', initialState, goal, solution, hints: solution.map(command => '`' + command + '`') };
};

export const githubScenarios: Scenario[] = [
  exercise('github-create', 'PRを作成する', 'push済みのfeature/loginからmainへPRを作成します。タイトルをAdd loginにし、変更内容を説明してください。', false,
    { type: 'github_state', params: { status: 'open', title: 'Add login', headBranch: 'feature/login', baseBranch: 'main', bodyNonEmpty: true } }, ['gh pr create --title "Add login" --body "ログイン機能とテストを追加" --base main']),
  exercise('github-view', 'PRの差分先と状態を確認', 'PR #1のタイトル・説明・統合先・承認・CIの状態を確認してください。', true,
    { type: 'command_executed', params: { command: 'gh pr view 1' } }, ['gh pr view 1']),
  exercise('github-review-feedback', '修正依頼を受け取る', '模擬レビュアーがテスト追加を求めます。simulateはこのアプリだけの練習コマンドです。PRを確認してください。', true,
    { type: 'github_state', params: { review: 'changes_requested', command: 'gh pr view 1' } }, ['simulate review request-changes 1 --body "テストを追加してください"', 'gh pr view 1']),
  exercise('github-ci-failure', 'CI失敗を確認', '模擬CIを失敗させ、PRのチェック結果を確認します。実際のCIジョブは実行しません。', true,
    { type: 'github_state', params: { checks: 'failure', command: 'gh pr checks 1' } }, ['simulate ci fail 1', 'gh pr checks 1']),
  exercise('github-approval', 'レビュー承認を得る', '模擬レビュアーから現在のコミットへの承認を受け取ってください。', true,
    { type: 'github_state', params: { review: 'approved' } }, ['simulate review approve 1 --body "確認しました"']),
  exercise('github-ci-success', 'CIの成功を確認', '模擬CIを成功させ、PRのチェック結果を確認してください。', true,
    { type: 'github_state', params: { checks: 'success', command: 'gh pr checks 1' } }, ['simulate ci pass 1', 'gh pr checks 1']),
  exercise('github-merge', '承認とCIを満たしてマージ', '未承認・CI待ちではマージできません。最新コミットへの承認とCI成功を揃え、mainへマージしてください。', true,
    { type: 'github_state', params: { status: 'merged', tree: { 'app.ts': 'version 2' } } }, ['simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge']),
  exercise('github-close', '不要になったPRを閉じる', '採用しないPRを閉じてください。mainに変更を取り込みません。', true,
    { type: 'github_state', params: { status: 'closed', tree: { 'app.ts': 'version 1' } } }, ['gh pr close 1']),
  exercise('github-review-fix', 'レビュー修正後に再チェック', '修正依頼とCI失敗を受け、app.tsをversion 3へ修正してpushします。修正後のコミットに承認とCI成功を揃えてマージしてください。', true,
    { type: 'github_state', params: { status: 'merged', tree: { 'app.ts': 'version 3' } } }, [
      'simulate review request-changes 1 --body "修正してください"', 'simulate ci fail 1',
      'echo "version 3" > app.ts', 'git add app.ts', 'git commit -m "Address review"', 'git push origin feature/login',
      'simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge'
    ])
];
