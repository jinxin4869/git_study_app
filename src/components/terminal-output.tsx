'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

export interface TerminalLine {
  type: 'command' | 'success' | 'error' | 'info';
  content: string;
}

/** Scroll only this viewport. Reading older output suspends following until explicitly resumed. */
export function TerminalOutput({ lines }: { lines: TerminalLine[] }) {
  const manualCopyId = useId();
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const [manualText, setManualText] = useState('');
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [seenLines, setSeenLines] = useState(lines);
  const hasNewOutput = !isFollowing && seenLines !== lines;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (following.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [lines]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !content.current) return;
    const observer = new ResizeObserver(() => {
      if (following.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  const copyOutput = async () => {
    const snapshot = lines.map(line => line.content).join('\n');
    setCopyState('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(snapshot);
      setManualText('');
      setCopyState('copied');
    } catch {
      setManualText(snapshot);
      setCopyState('manual');
    }
  };

  return <div className="flex-1 min-h-40 flex flex-col bg-black/50">
    <div className="shrink-0 px-3 border-b border-gray-700 text-sm">
      <button tabIndex={0} type="button" disabled={!lines.length || copyState === 'copying'} onClick={copyOutput} className="min-h-11 text-blue-200 underline disabled:opacity-50">端末出力をコピー</button>
      <p role="status">{copyState === 'copied' ? '押した時点の端末出力をコピーしました。' : copyState === 'manual' ? 'コピーできませんでした。下の内容を選択して手動でコピーしてください。' : copyState === 'copying' ? 'コピーしています。' : ''}</p>
      {copyState === 'manual' ? <div><label htmlFor={manualCopyId} className="block">手動でコピー</label><textarea id={manualCopyId} readOnly value={manualText} onFocus={event => event.currentTarget.select()} rows={3} className="block w-full rounded bg-gray-950 p-2 font-mono text-base text-gray-100" /></div> : null}
    </div>
    <div ref={viewport} role="region" aria-label="端末出力" tabIndex={0}
      onScroll={event => {
        const element = event.currentTarget;
        following.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 24;
        setIsFollowing(following.current);
        if (following.current) setSeenLines(lines);
      }}
      className="flex-1 min-h-0 overflow-auto p-4 font-mono text-sm focus-visible:outline-2 focus-visible:outline-blue-400">
      <div ref={content} className="space-y-2">
        {lines.map((line, index) => <div key={index}
          className={`whitespace-pre-wrap break-words ${line.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {line.content}
        </div>)}
      </div>
    </div>
    <button tabIndex={0} type="button" onClick={() => {
      following.current = true;
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
      setIsFollowing(true);
      setSeenLines(lines);
    }} className="min-h-11 shrink-0 px-3 text-left text-sm text-blue-200 border-t border-gray-700 focus-visible:outline-2 focus-visible:outline-blue-400">
      {hasNewOutput ? '新しい出力があります · ' : !isFollowing ? '過去の出力を表示中 · ' : ''}最新の出力へ戻る
    </button>
  </div>;
}
