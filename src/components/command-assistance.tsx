'use client';
import { useRef, useState } from 'react';
import type { GitState } from '@/types/git';
import { commandSuggestions } from '@/learning/command-suggestions';

export function CommandAssistance({value,history,state,onSelect}:{value:string;history:string[];state:GitState;onSelect:(value:string)=>void}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const select = (command:string) => { if(disclosure.current) disclosure.current.open=false; onSelect(command); };
  const [query,setQuery] = useState('');
  const matches=[...new Set([...history].reverse())].filter(command=>command.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,20);
  const suggestions=commandSuggestions(value,state);
  return <details ref={disclosure} onKeyDown={event=>{if(event.key==='Escape' && !event.nativeEvent.isComposing && event.keyCode!==229){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}} className="relative shrink-0 bg-gray-900 px-4 text-sm">
    <summary tabIndex={0} className="min-h-11 cursor-pointer">入力補完・履歴検索</summary>
    <div className="absolute bottom-full left-0 right-0 z-20 max-h-64 overflow-auto border border-gray-600 rounded bg-gray-900 p-3">
    <p>候補を選んでも実行しません。内容を確認し、コマンド欄でEnterを押します。入力末尾の候補が一つならTabで補完できます。最大20件を表示します。</p>
    <div aria-label="コマンド入力候補" className="max-h-40 overflow-auto flex flex-wrap gap-2 my-2">
      {suggestions.map(item=><button key={item.value} tabIndex={0} type="button" onClick={()=>select(item.value)} className="min-h-11 border border-gray-600 rounded px-2 font-mono break-all text-left">候補: {item.label}</button>)}
      {!suggestions.length ? <p>現在の入力に対する候補はありません。</p> : null}
    </div>
    <label className="block">履歴の検索<input type="search" value={query} maxLength={512} onChange={event=>setQuery(event.target.value)} className="block w-full min-h-11 bg-gray-950 border border-gray-600 rounded px-2 text-base" /></label>
    <div aria-label="コマンド履歴の検索結果" className="max-h-40 overflow-auto mt-2">
      {matches.map(command=><button key={command} tabIndex={0} type="button" onClick={()=>select(command)} className="block w-full min-h-11 border-b border-gray-700 text-left font-mono break-all">履歴: {command}</button>)}
      {!matches.length ? <p>一致する履歴がありません。</p> : null}
    </div>
    </div>
  </details>;
}
