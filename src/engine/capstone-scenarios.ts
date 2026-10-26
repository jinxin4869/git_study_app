import type { Commit, GitState, Scenario } from '@/types/git';
const c1: Commit = { id: 'c1', message: 'Initial', parents: [], tree: { 'app.ts': 'Base', 'README.md': 'Published docs', 'notes.md': 'Keep' }, author: 'User', changes: [], timestamp: 1 };
const c2: Commit = { ...c1, id: 'c2', message: 'Bug', parents: ['c1'], tree: { ...c1.tree, 'app.ts': 'Broken' } };
const base: GitState = { commits: { c1 }, branches: { main: 'c1' }, HEAD: { type: 'branch', value: 'main' }, index: {}, workingDirectory: c1.tree, detachedHead: false, stash: [], remotes: { origin: 'mock://team/project' }, remoteBranches: { 'origin/main': 'c1' }, mockServers: { origin: { commits: { c1 }, branches: { main: 'c1' } } } };
const lesson = (id: string, title: string, description: string, overrides: Partial<GitState>, params: Record<string, unknown>, solution: string[]): Scenario => ({
  id, title, description, category: 'ヒントなし総合課題', difficulty: 'advanced', practiceMode: 'independent', initialState: structuredClone({ ...base, ...overrides }), goal: { type: 'state_matches', params }, solution, hints: [],
});
export const capstoneScenarios: Scenario[] = [
  lesson('capstone-selective-delivery', '共有する修正と手元の下書きを分ける', 'app.tsのReadyだけをdeliveryブランチへ記録して仮想origin/deliveryへ共有してください。README.mdのDraft docsとnotes.mdのPrivate memoは手元の未stage編集として残し、公開版には混ぜません。mainのc1は動かさず、deliveryで終了します。',
    { workingDirectory: { 'app.ts': 'Ready', 'README.md': 'Draft docs', 'notes.md': 'Private memo' } },
    { branch: 'delivery', branches: { main: 'c1' }, tree: { 'app.ts': 'Ready', 'README.md': 'Published docs', 'notes.md': 'Keep' }, index: { 'app.ts': 'Ready', 'README.md': 'Published docs', 'notes.md': 'Keep' }, working: { 'app.ts': 'Ready', 'README.md': 'Draft docs', 'notes.md': 'Private memo' }, remoteBranch: 'delivery', remoteTree: { 'app.ts': 'Ready', 'README.md': 'Published docs', 'notes.md': 'Keep' }, upstreams: { delivery: 'origin/delivery' } },
    ['git status', 'git switch -c delivery', 'git add app.ts', 'git commit -m "Deliver application fix"', 'git push -u origin delivery']),
  lesson('capstone-shared-recovery', '共有済みの不具合を直し手元の作業を守る', 'origin/mainへ共有済みのBug c2でapp.tsがBrokenになっています。共有済みの履歴を残してBaseへ戻し、origin/mainにも反映してください。notes.mdのPrivate memoは手元の編集として残し、公開版には含めません。退避を使った場合は保管を残さず、mainで終了します。',
    { commits: { c1, c2 }, branches: { main: 'c2' }, workingDirectory: { ...c2.tree, 'notes.md': 'Private memo' }, remoteBranches: { 'origin/main': 'c2' }, mockServers: { origin: { commits: { c1, c2 }, branches: { main: 'c2' } } } },
    { branch: 'main', historyMessages: ['Revert "Bug"', 'Bug', 'Initial'], tree: { 'app.ts': 'Base', 'notes.md': 'Keep' }, index: { 'app.ts': 'Base', 'notes.md': 'Keep' }, working: { 'app.ts': 'Base', 'notes.md': 'Private memo' }, remoteTree: { 'app.ts': 'Base', 'notes.md': 'Keep' }, stashCount: 0 },
    ['git status', 'git stash push -m "Private work"', 'git revert c2', 'git stash pop', 'git push origin main']),
];
