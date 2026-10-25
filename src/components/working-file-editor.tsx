'use client';
import { useId,useState } from 'react';
import type { WorkingFileDraft } from '@/learning/working-file-edit';
import type { CommandResult } from '@/types/git';
export function WorkingFileEditor({draft,onApply,onClose}:{draft:WorkingFileDraft;onApply:(path:string,content:string|undefined)=>CommandResult;onClose:()=>void}) {
  const pathId=useId(),contentId=useId();
  const [path,setPath]=useState(draft.path??'');
  const [content,setContent]=useState(draft.content??'');
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [error,setError]=useState('');
  const apply=(value:string|undefined)=>{const result=onApply(path,value);if(!result.success)setError(result.message);};
  return <section aria-label="作業ファイルの編集" className="p-3 space-y-2 text-sm">
    <h3 className="font-bold">{draft.path===null?'ファイルを作成':'ファイルを編集'}</h3>
    <p>作業ツリーだけを変更します。stage・commitは別に実行します。閉じる・演習を切り替えると未保存の編集は破棄されます。</p>
    <label htmlFor={pathId} className="block">ファイルのパス</label><input id={pathId} value={path} readOnly={draft.path!==null} maxLength={512} onChange={event=>setPath(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="src/app.ts" className="w-full min-h-11 border border-gray-600 rounded bg-gray-950 px-2 text-base" />
    <label htmlFor={contentId} className="block">ファイルの内容</label><textarea id={contentId} value={content} maxLength={500000} onChange={event=>setContent(event.target.value)} rows={8} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full border border-gray-600 rounded bg-gray-950 p-2 font-mono text-base" />
    {error?<p role="alert" className="text-amber-200">{error}</p>:null}
    <div className="flex flex-wrap gap-3"><button type="button" tabIndex={0} onClick={()=>apply(content)} className="min-h-11 underline text-blue-200">作業ツリーに保存</button><button type="button" tabIndex={0} onClick={onClose} className="min-h-11 underline">編集をキャンセル</button>{draft.path!==null && draft.content!==undefined?<button type="button" tabIndex={0} onClick={()=>setConfirmDelete(true)} className="min-h-11 underline text-red-300">ファイルを削除</button>:null}</div>
    {confirmDelete?<div><p className="break-all">{path}を作業ツリーから削除します。stage済みの内容は残ります。</p><button type="button" tabIndex={0} onClick={()=>apply(undefined)} className="min-h-11 underline text-red-300 mr-3">削除する</button><button type="button" tabIndex={0} onClick={()=>setConfirmDelete(false)} className="min-h-11 underline">削除をキャンセル</button></div>:null}
  </section>;
}
