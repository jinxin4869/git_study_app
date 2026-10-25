import { GitEngine } from '@/engine/git-simulator';
import { headId } from '@/engine/git-state';
import type { GitState,CommandResult } from '@/types/git';
export interface WorkingFileDraft { path:string|null; content:string|undefined; context:string }
const context=(state:GitState)=>JSON.stringify([state.HEAD.type,state.HEAD.value,headId(state),state.activeWorktree]);
const quote=(value:string)=>'"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
export const openWorkingFile=(state:GitState,path:string|null):WorkingFileDraft=>({path,content:path===null?undefined:state.workingDirectory[path],context:context(state)});

export function applyWorkingFile(engine:GitEngine,draft:WorkingFileDraft,path:string,content:string|undefined):CommandResult {
  if(!path.trim() || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path) || path.length>512 || /[\0\r\n]/.test(path) || path.split('/').some(part=>!part || part==='.' || part==='..' || part.toLowerCase()==='.git'))return {success:false,message:'512文字以内の相対パスを入力してください。空の区切り・.・..・.git・改行は使えません。'};
  const state=engine.getState();
  if(draft.context!==context(state) || (draft.path!==null && (draft.path!==path || state.workingDirectory[path]!==draft.content)))return {success:false,message:'操作先やファイルの内容が変わりました。編集内容をコピーしてから開き直してください。'};
  if(draft.path===null && Object.hasOwn(state.workingDirectory,path))return {success:false,message:'同名のファイルがあります。一覧から開いて編集してください。'};
  if(Object.keys(state.workingDirectory).some(existing=>existing!==path && (existing.startsWith(path+'/') || path.startsWith(existing+'/'))))return {success:false,message:'ファイルとフォルダのパスが重なっています。別のパスを指定してください。'};
  if(content!==undefined && content.length>500000)return {success:false,message:'ファイルの内容は50万文字以下にしてください。'};
  return engine.execute(content===undefined ? `rm ${quote(path)}` : `echo ${quote(content)} > ${quote(path)}`);
}
