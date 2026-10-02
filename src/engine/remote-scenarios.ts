import { Commit, GitState, Scenario } from '@/types/git';

const commit = (id: string, parents: string[], tree: Record<string, string>, message: string): Commit => ({ id, parents, tree, message, timestamp: Number(id.slice(1)) || 1, author: 'Team', changes: [] });
const c1 = commit('c1', [], { 'app.ts': 'version 1' }, 'Initial');
const c2 = commit('c2', ['c1'], { 'app.ts': 'version 2' }, 'Team update');
const c3 = commit('c3', ['c1'], { 'app.ts': 'version 1', 'README.md': 'Local docs' }, 'Local docs');
const base: GitState = {
  commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' },
  index: {}, workingDirectory: c1.tree, detachedHead: false, stash: [],
  remotes: { origin: 'mock://team/project' }, remoteBranches: { 'origin/main': 'c1' },
  mockServers: { origin: { commits: { c1, c2 }, branches: { main: 'c2' } } }
};
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, params: Record<string, unknown>, solution: string[], command?: string): Scenario => ({
  id, title, description: '【仮想リモート】' + description, category: 'リモート・チーム開発', difficulty: 'intermediate',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) },
  goal: command ? { type: 'command_executed', params: { command } } : { type: 'state_matches', params },
  solution, hints: solution.map(command => '`' + command + '`')
});
const diverged = { commits: { c1, c3 }, branches: { main: 'c3' }, workingDirectory: c3.tree };

export const remoteScenarios: Scenario[] = [
  lesson('remote-clone', 'プロジェクトを取得', 'mock://team/projectをcloneし、最新mainのファイルを取得してください。外部通信は発生しません。', { commits: {}, branches: { main: '' }, workingDirectory: {}, remoteBranches: {} },
    { head: 'c2', working: { 'app.ts': 'version 2' }, upstreams: { main: 'origin/main' } }, ['git clone mock://team/project']),
  lesson('remote-list', '接続先を確認', 'fetchとpushの接続先URLを確認してください。', {}, {}, ['git remote -v'], 'remote -v'),
  lesson('remote-add', '接続先を登録', 'originがないリポジトリへ仮想接続先を登録してください。', { remotes: {}, mockServers: {}, remoteBranches: {} },
    { remotes: { origin: 'mock://team/project' } }, ['git remote add origin mock://team/project']),
  lesson('remote-url', '接続先URLを変更', '移転したプロジェクトへ接続先URLを変更してください。', {},
    { remotes: { origin: 'mock://team/new-project' } }, ['git remote set-url origin mock://team/new-project']),
  lesson('remote-fetch', '作業を変えずに更新を取得', 'origin/mainをc2へ更新します。ローカルmainと作業ファイルはc1のまま維持してください。', {},
    { head: 'c1', remoteBranches: { 'origin/main': 'c2' }, working: { 'app.ts': 'version 1' } }, ['git fetch origin']),
  lesson('remote-pull', 'mainを最新にする', '他メンバーの更新を取得し、mainをfast-forwardしてください。', {},
    { head: 'c2', working: { 'app.ts': 'version 2' }, clean: true }, ['git pull --ff-only origin main']),
  lesson('remote-first-push', '初回pushと追跡設定', 'ローカルmainを空の仮想リモートへpushし、追跡先も設定してください。', { mockServers: { origin: { commits: {}, branches: {} } }, remoteBranches: {} },
    { serverBranches: { main: 'c1' }, upstreams: { main: 'origin/main' } }, ['git push -u origin main']),
  lesson('remote-push', '共有済みmainへ変更を送る', '追加済みのローカル文書コミットを、最新の仮想リモートへpushしてください。', { ...diverged, mockServers: { origin: { commits: { c1 }, branches: { main: 'c1' } } } },
    { serverBranches: { main: 'c3' }, remoteTree: { 'README.md': 'Local docs' } }, ['git push origin main']),
  lesson('remote-integrate', 'push拒否から統合する', 'ローカルと他メンバーの履歴が分岐しています。fetchしてorigin/mainをマージし、双方の変更をリモートに送ってください。最初のpushは拒否されます。', diverged,
    { remoteTree: { 'app.ts': 'version 2', 'README.md': 'Local docs' }, tree: { 'app.ts': 'version 2', 'README.md': 'Local docs' }, clean: true }, ['git fetch origin', 'git merge origin/main', 'git push origin main']),
  lesson('remote-rebase', 'rebaseで最新mainに追従', '最新origin/mainへローカルの文書コミットを載せ替えてからpushしてください。', diverged,
    { historyMessages: ['Local docs', 'Team update', 'Initial'], remoteTree: { 'app.ts': 'version 2', 'README.md': 'Local docs' } }, ['git pull --rebase origin main', 'git push origin main']),
  lesson('remote-prune', '削除済み追跡ブランチを整理', 'リモートでは削除済みのorigin/obsoleteをローカルの追跡一覧から取り除いてください。ローカルmainは変えません。', { remoteBranches: { 'origin/main': 'c1', 'origin/obsolete': 'c1' } },
    { head: 'c1', remoteBranches: { 'origin/obsolete': null, 'origin/main': 'c2' } }, ['git fetch --prune origin']),
  lesson('remote-remove', '接続先を削除', '使わなくなったoriginを削除し、関連する追跡参照も整理してください。', {},
    { remotes: { origin: null }, remoteBranches: { 'origin/main': null } }, ['git remote remove origin'])
];
