import { GitState, Scenario } from '@/types/git';

const original = { 'app.ts': 'version 1', 'README.md': 'Project' };
const base: GitState = {
  commits: { c1: { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: original } },
  branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' },
  index: {}, workingDirectory: original, detachedHead: false,
  stash: [], remotes: {}, remoteBranches: {}, mockServers: {}
};

const exercise = (id: string, title: string, description: string, changes: Partial<GitState>, goal: Scenario['goal'], solution: string[]): Scenario => ({
  id, title, description, difficulty: 'intermediate', category: '日常操作・取り消し',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(changes)) },
  goal, solution, hints: solution.map(command => '`' + command + '`')
});

export const practicalScenarios: Scenario[] = [
  exercise('daily-status', '変更・ステージ・未追跡を区別', 'app.ts は変更済み、README.md はステージ済み、notes.txt は未追跡です。statusで違いを確認してください。', {
    workingDirectory: { 'app.ts': 'version 2', 'README.md': 'Updated', 'notes.txt': 'memo' },
    index: { 'README.md': { path: 'README.md', status: 'staged', content: 'Updated' } }
  }, { type: 'command_executed', params: { command: 'status' } }, ['git status']),
  exercise('daily-diff', '未ステージの差分', '変更したapp.tsをコミットする前に、変更内容をdiffで確認してください。', {
    workingDirectory: { ...original, 'app.ts': 'version 2' }
  }, { type: 'command_executed', params: { command: 'diff' } }, ['git diff']),
  exercise('daily-staged-diff', 'コミット対象の差分', 'ステージ後にapp.tsを再編集しました。今回コミットするversion 2の差分を確認してください。', {
    workingDirectory: { ...original, 'app.ts': 'version 3' },
    index: { 'app.ts': { path: 'app.ts', status: 'staged', content: 'version 2' } }
  }, { type: 'command_executed', params: { command: 'diff --staged' } }, ['git diff --staged']),
  exercise('daily-select', '一ファイルだけを記録', 'app.tsとREADME.mdを変更しました。app.tsだけをコミットし、README.mdの編集は作業中のまま残してください。', {
    workingDirectory: { 'app.ts': 'version 2', 'README.md': 'Draft' }
  }, { type: 'state_matches', params: { tree: { 'app.ts': 'version 2', 'README.md': 'Project' }, working: { 'README.md': 'Draft' } } }, ['git add app.ts', 'git commit -m "Update app"']),
  exercise('daily-after-stage', 'ステージ後の再編集', 'app.tsはversion 2をステージした後、version 3へ編集しました。version 2だけを記録してください。', {
    workingDirectory: { ...original, 'app.ts': 'version 3' },
    index: { 'app.ts': { path: 'app.ts', status: 'staged', content: 'version 2' } }
  }, { type: 'state_matches', params: { tree: { 'app.ts': 'version 2' }, working: { 'app.ts': 'version 3' } } }, ['git commit -m "Record version 2"']),
  exercise('daily-unstage', 'ステージだけを解除', 'app.tsを誤ってステージしました。編集内容version 2を残して、ステージを解除してください。', {
    workingDirectory: { ...original, 'app.ts': 'version 2' },
    index: { 'app.ts': { path: 'app.ts', status: 'staged', content: 'version 2' } }
  }, { type: 'state_matches', params: { index: { 'app.ts': 'version 1' }, working: { 'app.ts': 'version 2' } } }, ['git restore --staged app.ts']),
  exercise('daily-restore', '未ステージ編集を取り消す', 'app.tsの試行中の編集を、最後の記録であるversion 1に戻してください。', {
    workingDirectory: { ...original, 'app.ts': 'experiment' }
  }, { type: 'state_matches', params: { working: { 'app.ts': 'version 1' }, clean: true } }, ['git restore app.ts']),
  exercise('daily-restore-index', 'ステージ済み内容へ戻す', 'version 2をステージした後の試行だけを取り消してください。ステージ済みのversion 2は残します。', {
    workingDirectory: { ...original, 'app.ts': 'experiment' },
    index: { 'app.ts': { path: 'app.ts', status: 'staged', content: 'version 2' } }
  }, { type: 'state_matches', params: { working: { 'app.ts': 'version 2' }, index: { 'app.ts': 'version 2' } } }, ['git restore app.ts']),
  exercise('daily-delete', '削除を記録', '不要になったREADME.mdをgit rmで削除し、コミットにも削除を記録してください。', {},
    { type: 'state_matches', params: { message: 'Remove README', missingCommitted: 'README.md', working: { 'README.md': null } } }, ['git rm README.md', 'git commit -m "Remove README"']),
  exercise('daily-move', '名前変更を記録', 'app.tsをmain.tsへ移動してコミットしてください。ファイル内容を保持します。', {},
    { type: 'state_matches', params: { tree: { 'app.ts': null, 'main.ts': 'version 1' }, working: { 'app.ts': null, 'main.ts': 'version 1' } } }, ['git mv app.ts main.ts', 'git commit -m "Rename app"']),
  exercise('daily-amend-message', '直前のメッセージを修正', 'まだ共有していない直前のコミットのメッセージをClarify setupに修正してください。', {},
    { type: 'state_matches', params: { message: 'Clarify setup', parents: [], tree: original } }, ['git commit --amend -m "Clarify setup"']),
  exercise('daily-amend-file', '追加漏れを直前のコミットへ', 'まだ共有していないコミットにREADME.mdの追加変更を含めてください。メッセージはそのままにします。', {
    workingDirectory: { ...original, 'README.md': 'Updated' }
  }, { type: 'state_matches', params: { message: 'Initial commit', parents: [], tree: { 'README.md': 'Updated' } } }, ['git add README.md', 'git commit --amend --no-edit']),
  exercise('daily-switch', 'ブランチを作成して移動', 'feature/loginブランチを作成し、作業場所を移してください。', {},
    { type: 'branch_exists', params: { name: 'feature/login', checkedOut: true } }, ['git switch -c feature/login']),
  exercise('daily-split', '変更を目的別に記録', 'app.tsとREADME.mdの変更を、アプリ修正と文書修正の二つに分けてコミットしてください。最後のメッセージはUpdate docsにします。', {
    workingDirectory: { 'app.ts': 'version 2', 'README.md': 'Updated' }
  }, { type: 'state_matches', params: { historyMessages: ['Update docs', 'Update app', 'Initial commit'], tree: { 'app.ts': 'version 2', 'README.md': 'Updated' }, clean: true } }, ['git add app.ts', 'git commit -m "Update app"', 'git add README.md', 'git commit -m "Update docs"'])
];
