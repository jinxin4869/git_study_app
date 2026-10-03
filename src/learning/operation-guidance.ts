import { GitState } from '@/types/git';
export interface OperationGuidance { title: string; detail: string; commands: string[] }
export function operationGuidance(state: GitState): OperationGuidance | null {
  if (state.patchSession) return {
    title: '部分ステージング中', detail: `${state.patchSession.path} の変更 ${state.patchSession.cursor + 1}/${state.patchSession.chunks.length} を選択中。yで採用、nで見送り、qで終了します。終了まで他のコマンドは使えません。`, commands: ['y', 'n', 'q']
  };
  if (state.operation) {
    const op = state.operation;
    const detail = op.awaiting === 'todo' ? '下のコミット整理欄を編集してから続行してください。' :
      op.awaiting === 'reword' ? 'メッセージを変更してから続行します。' :
      op.awaiting === 'edit' ? '変更を編集・stage・commitし、追跡ファイルをクリーンにしてから続行します。' :
      '競合ファイルの内容を選び、git addで必要な変更をstageしてから続行します。skipは現在の変更を取り込まずに進みます。';
    return { title: `${op.kind} 中`, detail: `${op.current ? `現在: ${op.current.id} (${op.current.message})。` : ''}残り ${op.remaining.length} 件。${detail} abortは開始前へ戻します。`,
      commands: [...(op.awaiting === 'reword' ? ['git commit --amend -m "新しいメッセージ"'] : []), `git ${op.kind} --continue`, ...(op.awaiting ? [] : [`git ${op.kind} --skip`]), `git ${op.kind} --abort`] };
  }
  if (state.pendingMerge) return {
    title: 'merge 中', detail: '競合ファイルの内容を選び、git addで解決内容をstageしてからcommitで統合を完了します。abortは統合前の作業へ戻します。', commands: ['git status', 'git commit -m "Resolve merge"', 'git merge --abort']
  };
  if (state.bisect) return {
    title: 'bisect 中', detail: `${state.bisect.found ? `原因コミット: ${state.bisect.found}。` : `正常: ${state.bisect.good ?? '未指定'} / 異常: ${state.bisect.bad ?? '未指定'}。候補を調べてgoodまたはbadを指定します。`} resetで調査開始前へ戻ります。追跡ファイルの変更が残る場合は先に保存してください。`, commands: [...(state.bisect.found ? [] : ['git bisect good', 'git bisect bad']), 'git bisect reset']
  };
  return null;
}
