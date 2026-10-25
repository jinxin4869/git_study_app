import React, { useState, useMemo } from 'react';
import { Check } from 'lucide-react';

interface ConflictSolverProps {
  filePath: string;
  content: string;
  onResolve: (path: string, resolvedContent: string) => void;
  onCancel: () => void;
}

interface ConflictSection {
  type: 'text' | 'conflict';
  content?: string;
  current?: string;
  incoming?: string;
  id: string;
}

/**
 * ConflictSolver Component
 * 
 * Provides a UI for resolving merge conflicts.
 * It parses file content containing Git conflict markers (<<<<<<<, =======, >>>>>>>)
 * and allows the user to choose between Current Change, 取り込み側の変更, or Both.
 */
export function ConflictSolver({ filePath, content, onResolve, onCancel }: ConflictSolverProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'current' | 'incoming' | 'both' | null>>({});

  /**
   * 生のファイル内容を解析し、通常のテキストとコンフリクトブロックに分割します。
   */
  const sections = useMemo(() => {
    const text = content;
    if (!text.includes('<<<<<<<')) {
        return [{ type: 'text', content: text, id: 'text-full' } as ConflictSection];
    }

    const lines = text.split('\n');
    const parsed: ConflictSection[] = [];
    let currentSection: ConflictSection | null = null;
    let buffer: string[] = [];
    let state: 'normal' | 'current' | 'incoming' = 'normal';

    lines.forEach((line, index) => {
      if (line.startsWith('<<<<<<<') && state === 'normal') {
        // コンフリクトブロックの開始
        // 直前の通常テキストを追加
        if (buffer.length > 0) {
          parsed.push({ type: 'text', content: buffer.join('\n'), id: `text-${index}` });
          buffer = [];
        }
        state = 'current';
        currentSection = { type: 'conflict', current: '', incoming: '', id: `conflict-${index}` };
      } else if (line.startsWith('=======') && state === 'current' && currentSection) {
        // コンフリクトブロックの中間（区切り）
        if (state === 'current' && currentSection) {
          currentSection.current = buffer.join('\n');
          buffer = [];
          state = 'incoming';
        }
      } else if (line.startsWith('>>>>>>>') && state === 'incoming' && currentSection) {
        // コンフリクトブロックの終了
        if (state === 'incoming' && currentSection) {
          currentSection.incoming = buffer.join('\n');
          parsed.push(currentSection);
          currentSection = null;
          buffer = [];
          state = 'normal';
        }
      } else {
        // 通常行またはコンフリクトブロック内のコンテンツ
        buffer.push(line);
      }
    });

    if (state !== 'normal') return [{type:'text',content:text,id:'incomplete'} as ConflictSection];

    // 残りのテキストを追加
    if (buffer.length > 0) {
      parsed.push({ type: 'text', content: buffer.join('\n'), id: `text-end` });
    }

    return parsed;
  }, [content]);



  const handleDecision = (id: string, decision: 'current' | 'incoming' | 'both') => {
    setDecisions(prev => ({ ...prev, [id]: decision }));
  };

  /**
   * Reconstructs the file content based on user decisions and triggers onResolve.
   */
  const suggested = sections.map(s => {
    if (s.type === 'text') return s.content;
    const decision = decisions[s.id];
    if (decision === 'current') return s.current;
    if (decision === 'incoming') return s.incoming;
    if (decision === 'both') return s.current + '\n' + s.incoming;
    return `<<<<<<< HEAD\n${s.current}\n=======\n${s.incoming}\n>>>>>>> incoming`;
  }).join('\n');
  const result = draft ?? suggested;
  const allResolved = !/^(<<<<<<<|=======|>>>>>>>)/m.test(result);
  const handleComplete = () => { if (allResolved) onResolve(filePath, result); };

  const hasConflicts = content.includes('<<<<<<<');

  return (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 font-mono text-sm">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="min-w-0 break-all text-lg font-bold text-yellow-400">
            {hasConflicts ? `競合の解消: ${filePath}` : `ファイルの内容: ${filePath}`}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button tabIndex={0} onClick={onCancel} className="min-h-11 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white">
            {hasConflicts ? 'キャンセル' : '閉じる'}
          </button>
          {hasConflicts && (
            <button tabIndex={0}
                onClick={handleComplete} 
                disabled={!allResolved}
                className={`min-h-11 px-3 py-2 rounded flex items-center gap-2 ${allResolved ? 'bg-green-800 hover:bg-green-700 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
            >
                <Check size={16} /> 解消内容を適用
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <label htmlFor="conflict-result" className="block font-bold">解消結果のプレビュー・編集</label>
        <p>採用する行を直接編集できます。「両方」は正しいコードを保証しません。内容を確認し、適用後にgit addで解消を記録してください。</p>
        <textarea id="conflict-result" value={result} onChange={event => setDraft(event.target.value)} rows={8} spellCheck={false} className="w-full rounded border border-gray-600 bg-gray-950 p-2 text-base text-gray-100" />
        {draft !== null ? <button tabIndex={0} onClick={() => setDraft(null)} className="min-h-11 underline">選択結果から作り直す</button> : null}
        {!allResolved ? <p role="status">競合マーカーが残っています。</p> : <p role="status">適用する内容を確認してください。</p>}
      </div>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            {section.type === 'text' ? (
              <pre className="text-gray-400 whitespace-pre-wrap break-words">{section.content}</pre>
            ) : (
              <div className="border border-yellow-600 rounded overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-700">
                  {/* Current Changes Panel */}
                  <div className={`p-2 ${decisions[section.id] === 'current' || decisions[section.id] === 'both' ? 'bg-green-900/30' : 'bg-gray-800/50'}`}>
                    <div className="text-xs text-green-400 mb-1 font-bold">現在側の変更 (HEAD)</div>
                    <pre className="whitespace-pre-wrap break-words text-gray-300">{section.current}</pre>
                    <button tabIndex={0}
                      onClick={() => handleDecision(section.id, 'current')}
                      aria-pressed={decisions[section.id] === 'current'}
                      className={`mt-2 w-full min-h-11 py-2 text-xs rounded border ${decisions[section.id] === 'current' ? 'bg-green-800 border-green-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      現在側を採用
                    </button>
                  </div>

                  {/* 取り込み側の変更s Panel */}
                  <div className={`p-2 ${decisions[section.id] === 'incoming' || decisions[section.id] === 'both' ? 'bg-blue-900/30' : 'bg-gray-800/50'}`}>
                    <div className="text-xs text-blue-400 mb-1 font-bold">取り込み側の変更</div>
                    <pre className="whitespace-pre-wrap break-words text-gray-300">{section.incoming}</pre>
                    <button tabIndex={0}
                      onClick={() => handleDecision(section.id, 'incoming')}
                      aria-pressed={decisions[section.id] === 'incoming'}
                      className={`mt-2 w-full min-h-11 py-2 text-xs rounded border ${decisions[section.id] === 'incoming' ? 'bg-blue-800 border-blue-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      取り込み側を採用
                    </button>
                  </div>
                </div>
                <div className="p-2 bg-gray-800 border-t border-gray-700 text-center">
                   <button tabIndex={0}
                      onClick={() => handleDecision(section.id, 'both')}
                      aria-pressed={decisions[section.id] === 'both'}
                      className={`w-full min-h-11 py-2 text-xs rounded border ${decisions[section.id] === 'both' ? 'bg-purple-800 border-purple-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      両方を採用
                    </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
