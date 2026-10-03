import { Commit, GitState, Scenario } from '@/types/git';
const c1: Commit = { id: 'c1', message: 'Initial', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'app.ts': 'base' } };
const base: GitState = { commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' }, workingDirectory: c1.tree, index: {}, detachedHead: false, stash: [], remotes: {}, remoteBranches: {}, mockServers: {} };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, params: Record<string, unknown>, solution: string[], category = '並行作業・特殊構成'): Scenario => ({
  id, title, description: '【ブラウザ内の模擬環境】' + description, category, difficulty: 'advanced',
  initialState: { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(overrides)) }, goal: { type: 'state_matches', params }, solution, hints: solution.map(command => '`' + command + '`')
});
const history: Record<string, Commit> = {};
for (let i = 1; i <= 5; i++) history[`c${i}`] = { ...c1, id: `c${i}`, parents: i === 1 ? [] : [`c${i - 1}`], message: `Change ${i}`, tree: { 'app.ts': i < 3 ? 'good' : 'bad' } };
const bisectState = { commits: history, branches: { main: 'c5' }, workingDirectory: history.c5.tree };
const folders = { 'README.md': 'Project', 'src/app.ts': 'app', 'tests/spec.ts': 'test' };
const sparseState = { commits: { c1: { ...c1, tree: folders } }, workingDirectory: folders };
const dep1: Commit = { ...c1, id: 'dep1', tree: { 'lib.ts': 'v1' } };
const dep2: Commit = { ...dep1, id: 'dep2', parents: ['dep1'], tree: { 'lib.ts': 'v2' } };
const dependency = { remotes: { dependency: 'mock://deps/lib' }, mockServers: { dependency: { commits: { dep1, dep2 }, branches: { main: 'dep1' } } } };
const moduleFiles = { ...c1.tree, '.gitmodules': '[submodule "vendor/lib"]\n\tpath = vendor/lib\n\turl = mock://deps/lib\n', 'vendor/lib': 'Subproject commit dep1' };
const moduleState = { ...dependency, commits: { c1: { ...c1, tree: moduleFiles } }, workingDirectory: moduleFiles, submodules: { 'vendor/lib': { url: 'mock://deps/lib', commitId: 'dep1', initialized: false } } };

export const advancedScenarios: Scenario[] = [
  lesson('advanced-bisect-start', '原因調査を開始', '一本の履歴で二分探索を開始してください。ファイル内のgood/badを確認して候補を判定します。', bisectState,
    { bisectActive: true }, ['git bisect start'], '不具合の調査'),
  lesson('advanced-bisect-candidate', '正常・異常の範囲を指定', 'c5をbad、c1をgoodに指定し、検証する候補c3へ移動してください。', bisectState,
    { bisectActive: true, head: 'c3' }, ['git bisect start', 'git bisect bad c5', 'git bisect good c1'], '不具合の調査'),
  lesson('advanced-bisect-find', '導入コミットを特定', '候補のapp.tsをshowで読み、good/badを判定してください。最初に不具合が入ったc3を特定します。', bisectState,
    { bisectFound: 'c3', bisectActive: true }, ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'git show HEAD:app.ts', 'git bisect bad', 'git show HEAD:app.ts', 'git bisect good'], '不具合の調査'),
  lesson('advanced-bisect-reset', '調査後に元へ戻る', '原因c3を特定した後、調査前のmain/c5へ戻ってください。', bisectState,
    { bisectFound: 'c3', bisectActive: false, branch: 'main', head: 'c5' }, ['git bisect start', 'git bisect bad c5', 'git bisect good c1', 'git bisect bad', 'git bisect good', 'git bisect reset'], '不具合の調査'),
  lesson('advanced-worktree-add', '別の作業場所を用意', 'mainでのdraftを残し、../hotfixにhotfixブランチの仮想worktreeを作成してください。実際のディスクには作成しません。', { workingDirectory: { 'app.ts': 'draft' } },
    { worktrees: { '/workspace/hotfix': 'hotfix' }, working: { 'app.ts': 'draft' }, branches: { main: 'c1' } }, ['git worktree add -b hotfix ../hotfix main']),
  lesson('advanced-worktree-fix', '別worktreeで緊急修正', 'mainのdraftを残したまま別worktreeへ移動し、hotfixをFixedへ修正してコミットしてください。', { workingDirectory: { 'app.ts': 'draft' } },
    { branch: 'hotfix', tree: { 'app.ts': 'Fixed' }, branches: { main: 'c1' }, worktreeWorking: { '/workspace/project': { 'app.ts': 'draft' } } }, ['git worktree add -b hotfix ../hotfix main', 'cd ../hotfix', 'echo "Fixed" > app.ts', 'git add app.ts', 'git commit -m "Hotfix"']),
  lesson('advanced-worktree-remove', '完了したworktreeを削除', '不要な../hotfixを削除してください。hotfixブランチ自体は残します。', { branches: { main: 'c1', hotfix: 'c1' }, worktrees: { '/workspace/project': { branch: 'main', workingDirectory: c1.tree, index: {} }, '/workspace/hotfix': { branch: 'hotfix', workingDirectory: c1.tree, index: {} } }, activeWorktree: '/workspace/project' },
    { worktrees: { '/workspace/hotfix': null }, branches: { hotfix: 'c1' } }, ['git worktree remove ../hotfix']),
  lesson('advanced-sparse', '必要なディレクトリだけを展開', 'srcとルートのREADMEだけを展開してください。testsは作業場所から除外し、コミット内には残します。cone形式の基本を模擬します。', sparseState,
    { sparseCheckout: ['src'], working: { 'src/app.ts': 'app', 'tests/spec.ts': null }, tree: { 'tests/spec.ts': 'test' }, clean: true }, ['git sparse-checkout set src']),
  lesson('advanced-sparse-disable', '全ファイルの展開へ戻す', '限定した展開範囲を解除し、testsも作業場所へ戻してください。', { ...sparseState, sparseCheckout: ['src'], workingDirectory: { 'README.md': 'Project', 'src/app.ts': 'app' } },
    { sparseCheckout: null, working: folders, clean: true }, ['git sparse-checkout disable']),
  lesson('advanced-submodule-add', '依存リポジトリを追加', '仮想の依存リポジトリをvendor/libへ追加し、親リポジトリへ記録してください。submoduleはコミット参照として模擬表示します。', dependency,
    { submodules: { 'vendor/lib': { commitId: 'dep1', initialized: true } }, tree: { 'vendor/lib': 'Subproject commit dep1' } }, ['git submodule add mock://deps/lib vendor/lib', 'git commit -m "Add dependency"']),
  lesson('advanced-submodule-init', '依存リポジトリを初期化', '取得直後の未初期化submoduleを、親に記録されたdep1へ初期化してください。', moduleState,
    { submodules: { 'vendor/lib': { commitId: 'dep1', initialized: true } } }, ['git submodule update --init']),
  lesson('advanced-submodule-update', '依存更新を親へ記録', '依存側の最新dep2へ更新し、その参照を親リポジトリでadd・commitしてください。', { ...moduleState, submodules: { 'vendor/lib': { url: 'mock://deps/lib', commitId: 'dep1', initialized: true } }, mockServers: { dependency: { commits: { dep1, dep2 }, branches: { main: 'dep2' } } } },
    { submodules: { 'vendor/lib': { commitId: 'dep2', initialized: true } }, tree: { 'vendor/lib': 'Subproject commit dep2' } }, ['git submodule update --remote', 'git add vendor/lib', 'git commit -m "Update dependency"']),
  lesson('advanced-lfs-install', 'LFSの設定を有効にする', 'LFS設定を模擬的に有効にしてください。この演習は設定のみを扱い、実際のバイナリ転送・ポインタ変換は行いません。', {},
    { lfsInstalled: true }, ['git lfs install']),
  lesson('advanced-lfs-track', 'LFS対象の属性を共有', 'PNGをLFS対象に指定し、.gitattributesをコミットして共有してください。この模擬演習では実際のバイナリ変換は行いません。', {},
    { lfsInstalled: true, lfsPatterns: ['*.png'], tree: { '.gitattributes': '*.png filter=lfs diff=lfs merge=lfs -text\n' } }, ['git lfs install', 'git lfs track "*.png"', 'git add .gitattributes', 'git commit -m "Track PNG assets"'])
];
