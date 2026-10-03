import { Commit, GitState, Scenario } from '@/types/git';

const c1: Commit = { id: 'c1', message: 'Initial', parents: [], tree: { 'app.ts': 'base' }, changes: [], timestamp: 1, author: 'User' };
const c2: Commit = { ...c1, id: 'c2', message: 'Main', parents: ['c1'], tree: { 'app.ts': 'main version' } };
const c3: Commit = { ...c1, id: 'c3', message: 'Feature', parents: ['c1'], tree: { 'app.ts': 'feature version' } };
const c4: Commit = { ...c2, id: 'c4', message: 'Later', parents: ['c2'], tree: { 'app.ts': 'later version' } };
const base: GitState = { commits: { c1, c2, c3, c4 }, branches: { main: 'c2', feature: 'c3' }, HEAD: { type: 'branch', value: 'main' }, workingDirectory: c2.tree, index: {}, detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {} };
const saved = { id: 'saved', message: 'WIP', timestamp: 1, index: {}, baseTree: c1.tree, workingDirectory: { 'app.ts': 'draft' } };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, params: Record<string, unknown>, solution: string[], expectedFailures: string[] = [], category = '競合の継続・中断'): Scenario => ({
  id, title, description, category, difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) },
  goal: { type: 'state_matches', params }, solution, expectedFailures, hints: solution.map(command => '`' + command + '`')
});

export const operationScenarios: Scenario[] = [
  lesson('operation-rebase-continue', 'rebaseの競合を解消して続行', 'featureをmainへrebaseすると競合します。app.tsをResolvedに書き換えてステージし、rebaseを完了してください。', { HEAD: { type: 'branch', value: 'feature' }, workingDirectory: c3.tree },
    { operation: null, branch: 'feature', parents: ['c2'], message: 'Feature', tree: { 'app.ts': 'Resolved' } }, ['git rebase main', 'echo "Resolved" > app.ts', 'git add app.ts', 'git rebase --continue'], ['git rebase main']),
  lesson('operation-rebase-abort', 'rebaseを中断して元へ戻す', '競合したrebaseを中断し、元のfeatureと作業ファイルへ戻してください。', { HEAD: { type: 'branch', value: 'feature' }, workingDirectory: c3.tree },
    { command: 'rebase --abort', operation: null, branch: 'feature', head: 'c3', working: c3.tree }, ['git rebase main', 'git rebase --abort'], ['git rebase main']),
  lesson('operation-pick-continue', 'cherry-pickの競合を解消', 'c3をmainへ移植すると競合します。Resolvedに解消してステージし、移植を完了してください。', {},
    { operation: null, branch: 'main', parents: ['c2'], message: 'Feature', tree: { 'app.ts': 'Resolved' } }, ['git cherry-pick c3', 'echo "Resolved" > app.ts', 'git add app.ts', 'git cherry-pick --continue'], ['git cherry-pick c3']),
  lesson('operation-pick-abort', 'cherry-pickを中断', '競合した移植を中断し、元のmainの内容を取り戻してください。', {},
    { command: 'cherry-pick --abort', operation: null, head: 'c2', working: c2.tree }, ['git cherry-pick c3', 'git cherry-pick --abort'], ['git cherry-pick c3']),
  lesson('operation-revert-continue', 'revertの競合を解消', 'c2をrevertすると後続の編集と競合します。app.tsをbaseに解消し、取り消しコミットを作成してください。', { branches: { main: 'c4', feature: 'c3' }, workingDirectory: c4.tree },
    { operation: null, parents: ['c4'], message: 'Revert "Main"', tree: c1.tree }, ['git revert c2', 'echo "base" > app.ts', 'git add app.ts', 'git revert --continue'], ['git revert c2']),
  lesson('operation-revert-abort', 'revertを中断', '競合したrevertを中断し、後続の編集がある元の状態へ戻してください。', { branches: { main: 'c4', feature: 'c3' }, workingDirectory: c4.tree },
    { command: 'revert --abort', operation: null, head: 'c4', working: c4.tree }, ['git revert c2', 'git revert --abort'], ['git revert c2']),
  lesson('stash-tracked', '追跡ファイルだけを退避', 'app.tsのdraftをstashへ保存してください。未追跡のnotes.txtは作業場所に残します。', { branches: { main: 'c1' }, workingDirectory: { 'app.ts': 'draft', 'notes.txt': 'memo' } },
    { stashCount: 1, working: { 'app.ts': 'base', 'notes.txt': 'memo' }, clean: true }, ['git stash push -m "Draft app"'], [], '作業の退避'),
  lesson('stash-untracked', '未追跡ファイルも退避', 'app.tsと未追跡のnotes.txtを両方stashへ保存してください。', { branches: { main: 'c1' }, workingDirectory: { 'app.ts': 'draft', 'notes.txt': 'memo' } },
    { stashCount: 1, working: { 'app.ts': 'base', 'notes.txt': null } }, ['git stash push -u -m "All work"'], [], '作業の退避'),
  lesson('stash-apply', '保存を残して復元', 'stashのdraftを復元し、保存したstashは一件残してください。', { branches: { main: 'c1' }, workingDirectory: c1.tree, stash: [saved] },
    { stashCount: 1, working: { 'app.ts': 'draft' } }, ['git stash apply'], [], '作業の退避'),
  lesson('stash-pop', '復元して保存を削除', 'stashのdraftを復元し、適用できたstashをリストから削除してください。', { branches: { main: 'c1' }, workingDirectory: c1.tree, stash: [saved] },
    { stashCount: 0, working: { 'app.ts': 'draft' } }, ['git stash pop'], [], '作業の退避'),
  lesson('stash-select', '複数のstashから選ぶ', '古いstash@{1}のdraftを復元してください。新しいstashは採用せず、両方の保存を残します。', { branches: { main: 'c1' }, workingDirectory: c1.tree, stash: [saved, { ...saved, id: 'new', workingDirectory: { 'app.ts': 'new draft' } }] },
    { stashCount: 2, working: { 'app.ts': 'draft' } }, ['git stash apply stash@{1}'], [], '作業の退避'),
  lesson('stash-drop', '不要な保存を削除', '最新のstashだけを削除してください。作業ファイルには適用しません。', { branches: { main: 'c1' }, workingDirectory: c1.tree, stash: [saved] },
    { stashCount: 0, working: c1.tree }, ['git stash drop stash@{0}'], [], '作業の退避'),
  lesson('stash-conflict', 'stash復元時の競合', 'mainが変更されてからstashを復元すると競合します。保存を残し、app.tsをCombinedに解消してstageしてください。', { stash: [saved] },
    { stashCount: 1, working: { 'app.ts': 'Combined' }, head: 'c2', unmergedPaths: [] }, ['git stash pop', 'echo "Combined" > app.ts', 'git add app.ts'], ['git stash pop'], '作業の退避')
];
