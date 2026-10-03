import { Commit, GitState, Scenario } from '@/types/git';
const c1: Commit = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': 'version 1' } };
const c2: Commit = { ...c1, id: 'c2', message: 'Feature', parents: ['c1'], tree: { 'app.ts': 'version 2' } };
const c3: Commit = { ...c2, id: 'c3', message: 'Docs', parents: ['c2'], tree: { 'app.ts': 'version 2', 'README.md': 'Docs' } };
const base: GitState = { commits: { c1, c2, c3 }, branches: { main: 'c3' }, HEAD: { type: 'branch', value: 'main' }, index: {}, workingDirectory: c3.tree, detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {} };
const lesson = (id: string, title: string, description: string, params: Record<string, unknown>, solution: string[], overrides: Partial<GitState> = {}): Scenario => ({
  id, title, description: description + ' todoは編集欄で書き換えるか、このアプリ専用のsimulate rebase todoで設定できます。実Gitではエディタで編集します。', category: '履歴整理・対話的rebase', difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) },
  goal: { type: 'state_matches', params: { operation: null, ...params } }, solution,
  hints: solution.map(command => '`' + command + '`')
});
export const interactiveScenarios: Scenario[] = [
  lesson('interactive-squash', '二つのコミットをまとめる', 'FeatureとDocsをsquashし、両方のメッセージを残してください。',
    { parents: ['c1'], message: 'Feature\n\nDocs', tree: c3.tree }, ['git rebase -i HEAD~2', 'simulate rebase todo "pick c2;squash c3"', 'git rebase --continue']),
  lesson('interactive-fixup', '修正コミットを吸収', 'DocsをFeatureにfixupし、Featureのメッセージだけを残してください。',
    { parents: ['c1'], message: 'Feature', tree: c3.tree }, ['git rebase -i HEAD~2', 'simulate rebase todo "pick c2;fixup c3"', 'git rebase --continue']),
  lesson('interactive-reword', '過去のメッセージを修正', 'FeatureをImprove appへ変更してください。このアプリではrewordの一時停止後にcommit --amendで編集します。',
    { historyMessages: ['Docs', 'Improve app', 'Initial'], tree: c3.tree }, ['git rebase -i HEAD~2', 'simulate rebase todo "reword c2;pick c3"', 'git rebase --continue', 'git commit --amend -m "Improve app"', 'git rebase --continue']),
  lesson('interactive-reorder', 'コミットの順序を入れ替え', '文書のDocsを先に記録し、Featureを後にしてください。ファイル内容は保持します。',
    { historyMessages: ['Feature', 'Docs', 'Initial'], tree: c3.tree }, ['git rebase -i HEAD~2', 'simulate rebase todo "pick c3;pick c2"', 'git rebase --continue']),
  lesson('interactive-drop', '不要なコミットを除外', 'Featureをdropし、文書のDocsだけを残してください。app.tsはversion 1に戻ります。',
    { parents: ['c1'], message: 'Docs', tree: { 'app.ts': 'version 1', 'README.md': 'Docs' } }, ['git rebase -i HEAD~2', 'simulate rebase todo "drop c2;pick c3"', 'git rebase --continue']),
  lesson('interactive-split', '一つのコミットを二つに分割', 'まとめて記録したapp.tsとREADME.mdを、AppとDocsの二つのコミットへ分割してください。editで一時停止し、mixed resetして記録し直します。',
    { historyMessages: ['Docs', 'App', 'Initial'], historyTrees: [{ 'app.ts': 'version 2', 'README.md': 'Docs' }, { 'app.ts': 'version 2', 'README.md': null }], tree: c3.tree }, ['git rebase -i HEAD~1', 'simulate rebase todo "edit c2"', 'git rebase --continue', 'git reset --mixed HEAD~1', 'git add app.ts', 'git commit -m "App"', 'git add README.md', 'git commit -m "Docs"', 'git rebase --continue'],
    { commits: { c1, c2: { ...c2, tree: c3.tree } }, branches: { main: 'c2' }, workingDirectory: c3.tree })
];
