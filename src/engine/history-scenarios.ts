import { Commit, GitState, Scenario } from '@/types/git';

const c1: Commit = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': 'version 1' } };
const c2: Commit = { ...c1, id: 'c2', message: 'Feature', parents: ['c1'], tree: { 'app.ts': 'version 2' } };
const c3: Commit = { ...c1, id: 'c3', message: 'Docs', parents: ['c1'], tree: { 'app.ts': 'version 1', 'README.md': 'Documentation' } };
const base: GitState = {
  commits: { c1, c2, c3 }, branches: { main: 'c3', feature: 'c2' },
  HEAD: { type: 'branch', value: 'main' }, index: {}, workingDirectory: c3.tree,
  detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {}
};
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, goal: Scenario['goal'], solution: string[], category = '履歴・調査・復旧'): Scenario => ({
  id, title, description, category, difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) },
  goal, solution, hints: solution.map(command => '`' + command + '`')
});

export const historyScenarios: Scenario[] = [
  lesson('history-graph', '全ブランチの履歴を読む', 'mainとfeatureの分岐を、親コミットと一行メッセージで確認してください。', {},
    { type: 'command_executed', params: { command: 'log --oneline --graph --all' } }, ['git log --oneline --graph --all']),
  lesson('history-show', '一コミットの変更を確認', 'Featureコミットc2のメッセージと差分を確認してください。', {},
    { type: 'command_executed', params: { command: 'show c2' } }, ['git show c2']),
  lesson('history-show-file', '過去のファイルを読む', '作業ファイルを切り替えず、c1時点のapp.tsを読んでください。', {},
    { type: 'command_executed', params: { command: 'show c1:app.ts' } }, ['git show c1:app.ts']),
  lesson('history-config', '作者情報を設定', '模擬リポジトリ内にuser.nameとuser.emailを設定してください。ホストのGit設定には影響しません。', {},
    { type: 'state_matches', params: { config: { 'user.name': 'Learner', 'user.email': 'learner@example.test' } } }, ['git config user.name Learner', 'git config user.email learner@example.test'], '日常操作・取り消し'),
  lesson('history-rename-branch', '作業ブランチの名前変更', 'featureの名前をfeature/loginへ変更してください。コミット位置はc2のまま維持します。', {},
    { type: 'state_matches', params: { branches: { feature: null, 'feature/login': 'c2' } } }, ['git branch -m feature feature/login'], 'ブランチ'),
  lesson('history-delete-branch', '統合済みブランチを削除', 'featureはmainに統合済みです。mainにいる状態でfeatureを削除してください。', { branches: { main: 'c2', feature: 'c2' }, workingDirectory: c2.tree },
    { type: 'state_matches', params: { branch: 'main', branches: { feature: null, main: 'c2' } } }, ['git branch -d feature'], 'ブランチ'),
  lesson('history-detached-rescue', 'Detached HEADでの作業を保存', '過去のc2にいるDetached HEAD状態です。rescueブランチを作成して移動し、履歴を保存してください。', { HEAD: { type: 'commit', value: 'c2' }, detachedHead: true, workingDirectory: c2.tree },
    { type: 'state_matches', params: { branch: 'rescue', branches: { rescue: 'c2' }, working: { 'app.ts': 'version 2' } } }, ['git switch -c rescue'], 'ブランチ'),
  lesson('history-no-ff', '明示的なマージコミット', 'mainはfeatureの祖先です。--no-ffで統合したことを示す二親のコミットを作成してください。', { branches: { main: 'c1', feature: 'c2' }, workingDirectory: c1.tree },
    { type: 'state_matches', params: { branch: 'main', parents: ['c1', 'c2'], tree: c2.tree, clean: true } }, ['git merge --no-ff feature'], 'マージ'),
  lesson('history-rebase', '機能ブランチを最新mainへ', 'featureを最新mainへrebaseしてください。アプリ変更と文書変更の両方を残します。', { HEAD: { type: 'branch', value: 'feature' }, workingDirectory: c2.tree },
    { type: 'state_matches', params: { branch: 'feature', parents: ['c3'], tree: { 'app.ts': 'version 2', 'README.md': 'Documentation' } } }, ['git rebase main']),
  lesson('history-pick', '必要な修正だけを移植', 'mainへFeatureコミットc2だけを移植してください。main側の文書変更を保持します。', {},
    { type: 'state_matches', params: { branch: 'main', parents: ['c3'], message: 'Feature', tree: { 'app.ts': 'version 2', 'README.md': 'Documentation' } } }, ['git cherry-pick c2']),
  lesson('history-revert', '共有済みの変更を取り消す', 'Featureコミットc2をrevertしてください。後から追加した文書は残し、履歴を削除しません。', {
    commits: { c1, c2, c3, c4: { ...c3, id: 'c4', parents: ['c2'], tree: { 'app.ts': 'version 2', 'README.md': 'Documentation' } } },
    branches: { main: 'c4', feature: 'c2' }, workingDirectory: { 'app.ts': 'version 2', 'README.md': 'Documentation' }
  }, { type: 'state_matches', params: { parents: ['c4'], message: 'Revert "Feature"', tree: { 'app.ts': 'version 1', 'README.md': 'Documentation' } } }, ['git revert c2']),
  lesson('history-reflog', 'HEADの移動を調べる', 'reflogでreset前のHEADがc2だったことを確認してください。', { reflog: [{ id: 'c1', command: 'reset --hard HEAD~1' }, { id: 'c2', command: 'commit: Feature' }], branches: { main: 'c1' }, workingDirectory: c1.tree },
    { type: 'command_executed', params: { command: 'reflog' } }, ['git reflog']),
  lesson('history-recover-reset', 'resetで外れたコミットを救出', 'mainの直前コミットをhard resetで外した後、reflogからrescueブランチを作って作業を復元してください。', { branches: { main: 'c2' }, workingDirectory: c2.tree },
    { type: 'state_matches', params: { branch: 'rescue', head: 'c2', branches: { main: 'c1', rescue: 'c2' }, working: { 'app.ts': 'version 2' } } }, ['git reset --hard HEAD~1', 'git reflog', 'git branch rescue HEAD@{1}', 'git switch rescue']),
  lesson('history-tag', 'リリースへ軽量タグ', 'mainのc3にv1.0.0タグを付けてください。', {},
    { type: 'state_matches', params: { tags: { 'v1.0.0': 'c3' } } }, ['git tag v1.0.0']),
  lesson('history-annotated-tag', '注釈付きタグを作成', 'リリース説明を付けてmainのc3にv1.1.0タグを作成してください。', {},
    { type: 'state_matches', params: { tags: { 'v1.1.0': 'c3' }, tagMessages: { 'v1.1.0': 'Release 1.1.0' } } }, ['git tag -a v1.1.0 -m "Release 1.1.0"']),
  lesson('history-tag-branch', 'タグから保守ブランチ', 'v1.0.0が指すc1からmaintenanceブランチを作って移動してください。', { tags: { 'v1.0.0': { commitId: 'c1', message: 'Release' } } },
    { type: 'state_matches', params: { branch: 'maintenance', head: 'c1', working: { 'app.ts': 'version 1', 'README.md': null } } }, ['git switch -c maintenance v1.0.0'])
];
