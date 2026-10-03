import { Commit, GitState, Scenario } from '@/types/git';
import { remoteScenarios } from './remote-scenarios';

const separator = Array.from({ length: 8 }, (_, index) => `keep ${index + 1}\n`).join('');
const original = 'feature=off\n' + separator + 'logging=off\n';
const changed = 'feature=on\n' + separator + 'logging=on\n';
const selected = 'feature=on\n' + separator + 'logging=off\n';
const c1: Commit = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': original } };
const base: GitState = { commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' }, workingDirectory: c1.tree, index: {}, detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {} };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, goal: Scenario['goal'], solution: string[], category = '日常操作・取り消し'): Scenario => ({
  id, title, description, category, difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) }, goal, solution, hints: solution.map(command => '`' + command + '`')
});
const b1 = { ...c1, tree: { 'app.ts': 'old\nkeep\n' } };
const b2 = { ...c1, id: 'c2', message: 'Added line', parents: ['c1'], tree: { 'app.ts': 'added\nold\nkeep\n' } };
const b3 = { ...c1, id: 'c3', message: 'Feature', parents: ['c2'], tree: { 'app.ts': 'added\nupdated\nkeep\n' } };
const blameState = { commits: { c1: b1, c2: b2, c3: b3 }, branches: { main: 'c3' }, workingDirectory: b3.tree };
const divergent = remoteScenarios.find(s => s.id === 'remote-integrate')!;

export const precisionScenarios: Scenario[] = [
  lesson('precision-patch', '一ファイルの変更を分けて記録', 'app.tsの二つの変更のうちfeature=onだけを記録してください。git add -pで最初のハンクをy、次をnにします。logging=onは未ステージで残します。', { workingDirectory: { 'app.ts': changed } },
    { type: 'state_matches', params: { tree: { 'app.ts': selected }, working: { 'app.ts': changed } } }, ['git add -p app.ts', 'y', 'n', 'git commit -m "Enable feature"']),
  lesson('precision-ignore', '生成物を管理対象から除外', 'build/の生成物をignoreし、.gitignoreだけをコミットしてください。生成物は作業場所に残します。', { workingDirectory: { ...c1.tree, 'build/output.txt': 'generated' } },
    { type: 'state_matches', params: { tree: { '.gitignore': 'build/', 'build/output.txt': null }, working: { 'build/output.txt': 'generated' } } }, ['echo "build/" > .gitignore', 'git add .', 'git commit -m "Ignore builds"']),
  lesson('precision-untrack', '追跡済みファイルをignoreへ', '既に記録したdebug.logはignoreだけでは追跡をやめません。git rm --cachedで管理から外し、ファイルは手元に残してください。', { commits: { c1: { ...c1, tree: { ...c1.tree, 'debug.log': 'runtime log' } } }, workingDirectory: { ...c1.tree, 'debug.log': 'runtime log' } },
    { type: 'state_matches', params: { tree: { '.gitignore': '*.log', 'debug.log': null }, working: { 'debug.log': 'runtime log' } } }, ['echo "*.log" > .gitignore', 'git rm --cached debug.log', 'git add .gitignore', 'git commit -m "Stop tracking logs"']),
  lesson('precision-blame', '行の由来を調べる', 'app.tsの各行を最後に変更したコミットを調べてください。この模擬環境は一本の親履歴を追跡します。', blameState,
    { type: 'command_executed', params: { command: 'blame app.ts' } }, ['git blame app.ts'], '履歴・調査・復旧'),
  lesson('precision-diff-commits', '二コミットの差分', 'c1からc3までのapp.tsの変更を、作業ファイルを切り替えず比較してください。', blameState,
    { type: 'command_executed', params: { command: 'diff c1 c3 -- app.ts' } }, ['git diff c1 c3 -- app.ts'], '履歴・調査・復旧'),
  lesson('precision-log-file', '一ファイルの履歴', 'app.tsに変更があったコミットだけを確認してください。', blameState,
    { type: 'command_executed', params: { command: 'log -- app.ts' } }, ['git log -- app.ts'], '履歴・調査・復旧'),
  lesson('precision-log-grep', '変更理由を検索', 'Featureを含むメッセージを検索してください。', blameState,
    { type: 'command_executed', params: { command: 'log --grep Feature' } }, ['git log --grep Feature'], '履歴・調査・復旧'),
  { ...divergent, id: 'precision-lease', title: 'force-with-leaseの拒否から確認する', description: '想定外のリモート更新があるためforce-with-leaseは拒否されます。fetchして内容を確認し、双方の変更を統合して通常のpushで共有してください。',
    solution: ['git push --force-with-lease origin main', 'git fetch origin', 'git show origin/main', 'git merge origin/main', 'git push origin main'], expectedFailures: ['git push --force-with-lease origin main'],
    hints: ['force-with-leaseは、手元のリモート追跡参照と実際のリモート位置が違うと更新を拒否します。', 'fetchして内容を確認し、mergeした後に通常のpushを実行してください。'] },
  lesson('precision-tag-push', 'タグをリモートへ共有', 'v1.0.0タグとその履歴を仮想リモートへ送ってください。リモートmainはc1のまま維持します。', { ...blameState, tags: { 'v1.0.0': { commitId: 'c3', message: 'Release' } }, remotes: { origin: 'mock://team/project' }, remoteBranches: { 'origin/main': 'c1' }, mockServers: { origin: { commits: { c1: b1 }, branches: { main: 'c1' } } } },
    { type: 'state_matches', params: { serverTagBranches: { 'v1.0.0': 'main' }, serverBranches: { main: 'c1' } } }, ['git push origin v1.0.0'], '履歴・調査・復旧')
];
