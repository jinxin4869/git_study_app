import { CommandResult, GitState } from '@/types/git';
import { dictionary, cloneGitData } from './git-state';

// These commands change only the exercise's in-memory mock GitHub repository.
export function githubCommand(state: GitState, args: string[], simulated: boolean): CommandResult {
  const github = state.github;
  const server = state.mockServers.origin;
  const fail = (message: string): CommandResult => ({ success: false, message });
  if (!github || !server) return fail('GitHub模擬演習を選択してください。実際のGitHubには接続しません。');
  const success = (message: string): CommandResult => ({ success: true, message, newState: cloneGitData(state) });
  if (!simulated && args[0] !== 'pr') return fail('対応コマンド: gh pr create/view/checks/merge/close');
  const action = simulated ? args[0] : args[1];
  const values = new Map<string, string>();
  const targets: string[] = [];
  let merge = false;
  const allowed = !simulated && action === 'create' ? ['--title', '--body', '--base', '--head'] : simulated && action === 'review' ? ['--body'] : [];
  for (let i = 2; i < args.length; i++) {
    const token = args[i];
    if (allowed.includes(token)) {
      if (args[i + 1] === undefined || values.has(token)) return fail(`${token}には一つの値を指定してください。`);
      values.set(token, args[++i]);
    } else if (!simulated && action === 'merge' && token === '--merge') merge = true;
    else if (token.startsWith('-')) return fail(`模擬GitHubでは未対応の引数です: ${token}`);
    else targets.push(token);
  }
  const option = (name: string) => values.get(name);
  if (targets.length > (action === 'create' && !simulated ? 0 : 1)) return fail('模擬GitHubでは一つのPR番号を指定してください。createには追加の位置引数を指定しません。');
  if (action === 'create' && !simulated) {
    const head = option('--head') ?? (state.HEAD.type === 'branch' ? state.HEAD.value : '');
    const base = option('--base') ?? 'main';
    const title = option('--title');
    const body = option('--body');
    if (!title || body === undefined) return fail('gh pr create --title "タイトル" --body "説明" --base main');
    if (!server.branches[head] || !server.branches[base] || head === base || server.branches[head] === server.branches[base]) return fail('差分のあるブランチを先にpushしてください。');
    if (Object.values(github.pullRequests).some(pr => pr.status === 'open' && pr.head === head && pr.base === base)) return fail('このブランチのPRは既に作成済みです。');
    const number = Math.max(0, ...Object.keys(github.pullRequests).map(Number)) + 1;
    github.pullRequests[number] = { number, title, body, head, base, headCommit: server.branches[head], status: 'open' };
    return success(`模擬PR #${number} を作成しました。レビューとCI結果を確認してください。`);
  }
  const reference = targets[0] ?? '1';
  if (!/^[1-9]\d*$/.test(reference) || !Number.isSafeInteger(Number(reference))) return fail('PR番号には正の整数を指定してください。');
  const number = Number(reference);
  const pr = github.pullRequests[number];
  if (!pr) return fail('指定したPRがありません。');
  const latest = server.branches[pr.head];
  if (!latest) return fail('PRのリモートブランチがありません。');
  if (simulated) {
    if (pr.status !== 'open') return fail('PRは開いていません。');
    if (action === 'ci' && ['pass', 'fail'].includes(args[1])) {
      pr.checks = { commitId: latest, status: args[1] === 'pass' ? 'success' : 'failure' };
      return success(`模擬CI: ${pr.checks.status} (${latest})`);
    }
    if (action === 'review' && ['approve', 'request-changes'].includes(args[1])) {
      pr.review = { commitId: latest, result: args[1] === 'approve' ? 'approved' : 'changes_requested', body: option('--body') ?? '' };
      return success(`模擬レビュアー: ${pr.review.result}`);
    }
    return fail('模擬操作: simulate ci pass|fail [番号] / simulate review approve|request-changes [番号] --body "コメント"');
  }
  if (action === 'view') return success(`#${pr.number} ${pr.title}\n${pr.body}\n${pr.head} → ${pr.base}\n状態: ${pr.status}\nレビュー: ${pr.review?.commitId === latest ? pr.review.result : '承認待ち'}\nCI: ${pr.checks?.commitId === latest ? pr.checks.status : '実行待ち'}`);
  if (action === 'checks') return success(`CI: ${pr.checks?.commitId === latest ? pr.checks.status : 'pending'} (${latest})`);
  if (pr.status !== 'open') return fail('PRは開いていません。');
  if (action === 'close') {
    pr.status = 'closed';
    return success(`PR #${number} を閉じました。`);
  }
  if (action !== 'merge') return fail('対応コマンド: gh pr create/view/checks/merge/close');
  if (!merge) return fail('この演習では gh pr merge [番号] --merge を使います。');
  if (github.requireReview && (pr.review?.commitId !== latest || pr.review.result !== 'approved')) return fail('最新コミットへの承認が必要です。');
  if (github.requireCI && (pr.checks?.commitId !== latest || pr.checks.status !== 'success')) return fail('最新コミットのCI成功が必要です。');
  // Find a common ancestor and merge file snapshots; do not drop target changes.
  const ancestors = new Set<string>();
  const collect = (id: string) => {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    server.commits[id]?.parents.forEach(collect);
  };
  const baseId = server.branches[pr.base];
  collect(baseId);
  const queue = [latest];
  const visited = new Set<string>();
  let common: string | undefined;
  while (queue.length) {
    const id = queue.shift()!;
    if (ancestors.has(id)) { common = id; break; }
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(...(server.commits[id]?.parents ?? []));
  }
  if (!common) return fail('共通の祖先がありません。');
  const original = server.commits[common].tree;
  const ours = server.commits[baseId].tree;
  const theirs = server.commits[latest].tree;
  const tree = dictionary<string>();
  for (const path of new Set([...Object.keys(original), ...Object.keys(ours), ...Object.keys(theirs)])) {
    if (ours[path] !== theirs[path] && ours[path] !== original[path] && theirs[path] !== original[path]) return fail('競合があります。ローカルでbaseを統合・解消してpushしてください。');
    const content = ours[path] === original[path] ? theirs[path] : ours[path];
    if (content !== undefined) tree[path] = content;
  }
  const id = 'pr-' + Math.random().toString(36).slice(2, 9);
  server.commits[id] = { id, message: `Merge PR #${number}: ${pr.title}`, parents: [baseId, latest], timestamp: Date.now(), author: 'Mock GitHub', changes: [], tree };
  server.branches[pr.base] = id;
  pr.headCommit = latest;
  pr.status = 'merged';
  return success(`模擬PR #${number} をマージしました。git fetchでローカルへ取得できます。`);
}
