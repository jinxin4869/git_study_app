import React, { useState } from 'react';
import type { GitState } from '@/types/git';
import { headTree, indexTree } from '@/engine/git-state';
import { generateDiff } from '@/utils/diff-utils';
import { X, FileText } from 'lucide-react';

interface FilePreviewProps {
  file: { path: string; content: string | undefined } | null;
  onClose: () => void;
  state?: GitState;
}

export function FilePreview({ file, onClose, state }: FilePreviewProps) {
  const [compare, setCompare] = useState(false);
  if (!file) return null;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
        <div className="flex min-w-0 items-center gap-2 text-gray-200">
          <FileText className="w-4 h-4 shrink-0 text-blue-400" />
          <span className="break-all font-medium text-sm">{file.path}</span>
        </div>
        <button tabIndex={0}
          onClick={onClose}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="プレビューを閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {state ? <button tabIndex={0} onClick={() => setCompare(value => !value)} aria-expanded={compare} className="min-h-11 px-4 text-left text-blue-200 underline">{compare ? '作業ツリーだけ表示' : 'HEAD・ステージ・作業ツリーを比較'}</button> : null}
      <div className="flex-1 overflow-auto p-4">
        {compare && state ? <section aria-label="3領域の比較" className="space-y-4">
          {Object.entries({ HEAD: headTree(state)[file.path], 'ステージ': indexTree(state)[file.path], '作業ツリー': file.content }).map(([name, content]) => <div key={name}><h3 className="font-bold">{name}</h3>{content === undefined ? <p>ファイルなし</p> : <pre className="whitespace-pre-wrap break-all">{content || '（空ファイル）'}</pre>}</div>)}
          <h3>HEAD → ステージ</h3><pre className="whitespace-pre-wrap break-all">{generateDiff(file.path, headTree(state)[file.path] ?? '', indexTree(state)[file.path] ?? '')}</pre>
          <h3>ステージ → 作業ツリー</h3><pre className="whitespace-pre-wrap break-all">{generateDiff(file.path, indexTree(state)[file.path] ?? '', file.content ?? '')}</pre>
        </section> : <>

        {file.content === undefined ? <p role="status" className="text-sm text-gray-300">このファイルは現在の作業ツリーにありません。</p> : <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap break-all">
          {file.content}
        </pre>}
        </>}
      </div>
    </div>
  );
}
