'use client';

import { useLayoutEffect, useRef, useState } from 'react';

export interface TerminalLine {
  type: 'command' | 'success' | 'error' | 'info';
  content: string;
}

/** Scroll only this viewport. Reading older output suspends following until explicitly resumed. */
export function TerminalOutput({ lines }: { lines: TerminalLine[] }) {
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

  return <div className="flex-1 min-h-40 flex flex-col bg-black/50">
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
    <button type="button" onClick={() => {
      following.current = true;
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
      setIsFollowing(true);
      setSeenLines(lines);
    }} className="min-h-11 shrink-0 px-3 text-left text-sm text-blue-200 border-t border-gray-700 focus-visible:outline-2 focus-visible:outline-blue-400">
      {hasNewOutput ? '新しい出力があります · ' : !isFollowing ? '過去の出力を表示中 · ' : ''}最新の出力へ戻る
    </button>
  </div>;
}
