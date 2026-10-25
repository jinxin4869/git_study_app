import type { Commit } from '@/types/git';

export function CommitDetails({commit,parent,onClose}:{commit:Commit;parent:Commit|undefined;onClose:()=>void}) {
  const before=parent?.tree ?? {};
  const paths=[...new Set([...Object.keys(before),...Object.keys(commit.tree)])].filter(path=>before[path]!==commit.tree[path]).sort();
  const date=new Date(commit.timestamp);
  return <section aria-label="選択したコミットの詳細" className="shrink-0 max-h-44 overflow-auto border-t border-gray-700 bg-gray-900 p-3 text-sm">
    <div className="flex items-center justify-between gap-2"><h3 className="font-bold break-words">{commit.message}</h3><button type="button" tabIndex={0} onClick={onClose} className="min-h-11 shrink-0 underline">詳細を閉じる</button></div>
    <dl className="break-all"><dt>コミットID</dt><dd className="font-mono">{commit.id}</dd><dt>作者</dt><dd>{commit.author}</dd><dt>日時（模擬）</dt><dd>{Number.isFinite(date.getTime()) ? date.toISOString() : '日時不明'}</dd><dt>親コミット</dt><dd>{commit.parents.join('、') || 'なし（最初のコミット）'}</dd></dl>
    <p>変更ファイル（第一親との差分）: {paths.length}件</p>
    <ul>{paths.map(path=><li key={path} className="break-all">{before[path]===undefined?'追加':commit.tree[path]===undefined?'削除':'変更'}: {path}</li>)}</ul>
  </section>;
}
