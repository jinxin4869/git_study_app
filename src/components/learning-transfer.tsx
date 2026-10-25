'use client';
import { useState } from 'react';
import { MAX_BACKUP_BYTES, exportBackup, importBackup, readBackup, parseSession, saveSession, sessionKey, type SavedSession, type LearningBackup } from '@/learning/session-store';

interface Props {
  ids: Set<string>; categories: Set<string>; scenarioId: string | null;
  capture: () => SavedSession; resume: (session: SavedSession) => void; imported: () => void;
}
export function LearningTransfer({ ids, categories, scenarioId, capture, resume, imported }: Props) {
  const [message,setMessage] = useState('');
  const [pending,setPending] = useState<LearningBackup | null>(null);
  const attempt = (operation: () => void) => {
    try { operation(); } catch (error) { setMessage(error instanceof Error ? error.message : '保存領域を利用できません。'); }
  };
  return <details className="p-3 border-b border-gray-800 text-sm space-y-2">
    <summary tabIndex={0} className="min-h-11 cursor-pointer">途中状態・バックアップ</summary>
    <p>ボタンで保存した時点のGit・操作中の状態・端末履歴・ヒント段階を再開できます。再読み込み後に「保存した途中状態を再開」を選びます。未適用の競合編集は適用してから保存してください。再開すると現在の途中状態を置き換えます。</p>
    <button tabIndex={0} className="block min-h-11 underline" onClick={() => attempt(() => { saveSession(window.localStorage,capture(),ids); setMessage('現在の途中状態を保存しました。'); })}>現在の途中状態を保存</button>
    <button tabIndex={0} className="block min-h-11 underline" onClick={() => attempt(() => { const raw = window.localStorage.getItem(sessionKey(scenarioId)); if (!raw) throw new Error('この演習の途中状態はまだ保存されていません。'); resume(parseSession(raw,ids)); setMessage('保存した途中状態を再開しました。'); })}>保存した途中状態を再開</button>
    <p>バックアップには保存済みの完了・ヒント・選択・途中状態が含まれます。保存エラーがある場合は先に保存を再試行してください。入力したファイル内容やコマンドも含むため、保管先を確認してください。</p>
    <button tabIndex={0} className="block min-h-11 underline" onClick={() => attempt(() => { const raw = exportBackup(window.localStorage,ids,categories); const url = URL.createObjectURL(new Blob([raw],{type:'application/json'})); const anchor = document.createElement('a'); anchor.href=url; anchor.download='git-learning-backup.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000); setMessage('バックアップを書き出しました。'); })}>バックアップを書き出す</button>
    <label className="block min-h-11">バックアップを選ぶ<input type="file" accept="application/json,.json" className="block w-full" onChange={async event => { setPending(null); const file=event.target.files?.[0]; event.target.value=''; if (!file) return; if(file.size>MAX_BACKUP_BYTES) { setMessage('バックアップは5MB以下にしてください。'); return; } try { const backup = readBackup(await file.text(),ids,categories); setPending(backup); setMessage(`${backup.records.length}件を取り込みます。同じキーの保存記録を置き換え、その他の記録は残します。現在のGitは変わりません。`); } catch(error) { setMessage(error instanceof Error ? error.message : 'ファイルを読み込めません。'); } }} /></label>
    {pending ? <div><button tabIndex={0} className="min-h-11 underline mr-3" onClick={() => attempt(() => { importBackup(window.localStorage,pending,ids,categories); setPending(null); imported(); setMessage('取り込みました。途中状態は演習を選んでから再開できます。'); })}>この内容を取り込む</button><button tabIndex={0} className="min-h-11 underline" onClick={() => setPending(null)}>取り込みをキャンセル</button></div> : null}
    <p role="status" className="break-words">{message}</p>
  </details>;
}
