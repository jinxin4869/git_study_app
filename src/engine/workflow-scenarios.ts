import { Commit, GitState, Scenario } from '@/types/git';

const root = { 'app.ts': 'base', 'notes.md': 'Keep', 'security.ts': 'vulnerable' };
const c1: Commit = { id: 'c1', message: 'Initial', parents: [], tree: root, author: 'User', changes: [], timestamp: 1 };
const commit = (id: string, message: string, parents: string[], tree: Record<string, string>): Commit => ({ ...c1, id, message, parents, tree });
const base: GitState = { commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' }, index: {}, workingDirectory: root, detachedHead: false, stash: [], remotes: { origin: 'mock://team/project' }, remoteBranches: { 'origin/main': 'c1' }, mockServers: { origin: { commits: { c1 }, branches: { main: 'c1' } } } };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, goal: Scenario['goal'], solution: string[], expectedFailures: string[] = []): Scenario => ({
  id, title, description, category: '実務の総合演習', difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) }, goal, solution, expectedFailures,
  hints: solution.map(command => '`' + command + '`')
});
const remote = commit('c2', 'Team change', ['c1'], { ...root, 'app.ts': 'Remote' });
const local = commit('c3', 'Local change', ['c1'], { ...root, 'app.ts': 'Local' });
const feature = commit('c2', 'Feature', ['c1'], { ...root, 'feature.ts': 'Draft' });
const appFeature = commit('c2', 'Feature', ['c1'], { ...root, 'app.ts': 'Feature' });
const docs = commit('c3', 'Docs', ['c2'], { ...appFeature.tree, 'README.md': 'Feature docs' });
const teamDocs = commit('c4', 'Team docs', ['c1'], { ...root, 'README.md': 'Team docs' });
const bug = commit('c2', 'Bug', ['c1'], { ...root, 'app.ts': 'Broken' });
const laterDocs = commit('c3', 'Docs', ['c2'], { ...bug.tree, 'README.md': 'Useful docs' });

export const workflowScenarios: Scenario[] = [
  lesson('workflow-feature', '機能開発からレビュー・マージまで', 'mainから機能ブランチを作り、feature.txtを記録して仮想リモートへpushします。PRを作成し、模擬レビュー承認とCI成功を揃えてmainへ取り込んでください。',
    { github: { requireReview: true, requireCI: true, pullRequests: {} } },
    { type: 'github_state', params: { status: 'merged', tree: { 'feature.txt': 'New feature' } } }, [
      'git switch -c feature', 'echo "New feature" > feature.txt', 'git add feature.txt', 'git commit -m "Feature"', 'git push -u origin feature',
      'gh pr create --title "Feature" --body "機能と確認手順を追加" --base main', 'simulate review approve 1', 'simulate ci pass 1', 'gh pr merge 1 --merge'
    ]),
  lesson('workflow-conflict', '他メンバーと競合した変更を共有', 'mainのpushが拒否されます。取得後のmergeも競合します。app.tsをCombinedに解消し、双方の履歴を保ったコミットをリモートへ送ってください。',
    { commits: { c1, c3: local }, branches: { main: 'c3' }, workingDirectory: local.tree, mockServers: { origin: { commits: { c1, c2: remote }, branches: { main: 'c2' } } } },
    { type: 'state_matches', params: { parents: ['c3', 'c2'], tree: { 'app.ts': 'Combined' }, remoteTree: { 'app.ts': 'Combined' }, clean: true } },
    ['git push origin main', 'git fetch origin', 'git merge origin/main', 'echo "Combined" > app.ts', 'git add app.ts', 'git commit -m "Resolve"', 'git push origin main'], ['git push origin main', 'git merge origin/main']),
  lesson('workflow-urgent', '開発中の作業を退避して緊急修正', 'feature.tsのWorkingを退避し、mainからhotfixを作ってapp.tsをFixedへ修正します。mainへ統合後、featureへ修正を移植し、元の作業を復元してください。',
    { commits: { c1, c2: feature }, branches: { main: 'c1', feature: 'c2' }, HEAD: { type: 'branch', value: 'feature' }, workingDirectory: { ...feature.tree, 'feature.ts': 'Working' } },
    { type: 'state_matches', params: { branch: 'feature', tree: { 'app.ts': 'Fixed', 'feature.ts': 'Draft' }, working: { 'feature.ts': 'Working' }, branchTrees: { main: { 'app.ts': 'Fixed' } }, stashCount: 0 } },
    ['git stash push -m "Feature work"', 'git switch -c hotfix main', 'echo "Fixed" > app.ts', 'git add app.ts', 'git commit -m "Hotfix"', 'git switch main', 'git merge hotfix', 'git switch feature', 'git cherry-pick hotfix', 'git stash pop']),
  lesson('workflow-cleanup', 'レビュー前に履歴と変更を整理', 'notes.mdの試行を取り消し、FeatureとDocsをfixupでまとめます。最新mainへrebaseし、文書の競合をCombined docsに解消してください。',
    { commits: { c1, c2: appFeature, c3: docs, c4: teamDocs }, branches: { main: 'c4', feature: 'c3' }, HEAD: { type: 'branch', value: 'feature' }, workingDirectory: { ...docs.tree, 'notes.md': 'Experiment' } },
    { type: 'state_matches', params: { operation: null, branch: 'feature', historyMessages: ['Feature', 'Team docs', 'Initial'], tree: { 'app.ts': 'Feature', 'README.md': 'Combined docs', 'notes.md': 'Keep' }, clean: true } },
    ['git restore notes.md', 'git rebase -i HEAD~2', 'simulate rebase todo "pick c2;fixup c3"', 'git rebase --continue', 'git rebase main', 'echo "Combined docs" > README.md', 'git add README.md', 'git rebase --continue'], ['git rebase main']),
  lesson('workflow-recovery', '削除した作業ブランチを復旧', 'featureへ移動して内容を確認し、mainへ戻ってfeatureを削除します。その後、reflogからrescueブランチとして復元してください。',
    { commits: { c1, c2: appFeature }, branches: { main: 'c1', feature: 'c2' } },
    { type: 'state_matches', params: { branch: 'rescue', head: 'c2', branches: { feature: null, rescue: 'c2' }, working: { 'app.ts': 'Feature' } } },
    ['git switch feature', 'git show HEAD:app.ts', 'git switch main', 'git branch -D feature', 'git reflog', 'git branch rescue HEAD@{1}', 'git switch rescue']),
  lesson('workflow-revert', '共有済みの不具合だけを取り消す', '共有済みのBugコミットc2をrevertし、正常な文書変更を残してpushしてください。履歴を消さず取り消しコミットを追加します。',
    { commits: { c1, c2: bug, c3: laterDocs }, branches: { main: 'c3' }, workingDirectory: laterDocs.tree, remoteBranches: { 'origin/main': 'c3' }, mockServers: { origin: { commits: { c1, c2: bug, c3: laterDocs }, branches: { main: 'c3' } } } },
    { type: 'state_matches', params: { parents: ['c3'], message: 'Revert "Bug"', tree: { 'app.ts': 'base', 'README.md': 'Useful docs' }, remoteTree: { 'app.ts': 'base', 'README.md': 'Useful docs' } } },
    ['git show c2', 'git revert c2', 'git push origin main']),
  lesson('workflow-release', 'リリース後の修正を両系統へ', 'v1.0.0からmaintenanceを作り、security.tsをFixedへ修正します。注釈付きv1.0.1を付けて共有し、mainにも修正を移植してpushしてください。',
    { commits: { c1, c2: appFeature }, branches: { main: 'c2' }, workingDirectory: appFeature.tree, tags: { 'v1.0.0': { commitId: 'c1', message: 'Release' } }, remoteBranches: { 'origin/main': 'c2' }, mockServers: { origin: { commits: { c1, c2: appFeature }, branches: { main: 'c2' } } } },
    { type: 'state_matches', params: { branch: 'main', tree: { 'app.ts': 'Feature', 'security.ts': 'Fixed' }, remoteTree: { 'app.ts': 'Feature', 'security.ts': 'Fixed' }, branchTrees: { maintenance: { 'app.ts': 'base', 'security.ts': 'Fixed' } }, tagBranches: { 'v1.0.1': 'maintenance' }, serverTagBranches: { 'v1.0.1': 'maintenance' }, tagMessages: { 'v1.0.1': 'Patch release' } } },
    ['git switch -c maintenance v1.0.0', 'echo "Fixed" > security.ts', 'git add security.ts', 'git commit -m "Security fix"', 'git tag -a v1.0.1 -m "Patch release"', 'git push origin v1.0.1', 'git switch main', 'git cherry-pick maintenance', 'git push origin main'])
];
