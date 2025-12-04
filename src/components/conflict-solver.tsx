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
 * and allows the user to choose between Current Change, Incoming Change, or Both.
 */
export function ConflictSolver({ filePath, content, onResolve, onCancel }: ConflictSolverProps) {
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
      if (line.startsWith('<<<<<<<')) {
        // コンフリクトブロックの開始
        // 直前の通常テキストを追加
        if (buffer.length > 0) {
          parsed.push({ type: 'text', content: buffer.join('\n'), id: `text-${index}` });
          buffer = [];
        }
        state = 'current';
        currentSection = { type: 'conflict', current: '', incoming: '', id: `conflict-${index}` };
      } else if (line.startsWith('=======')) {
        // コンフリクトブロックの中間（区切り）
        if (state === 'current' && currentSection) {
          currentSection.current = buffer.join('\n');
          buffer = [];
          state = 'incoming';
        }
      } else if (line.startsWith('>>>>>>>')) {
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
  const handleComplete = () => {
    let resolved = '';
    sections.forEach(s => {
      if (s.type === 'text') {
        resolved += s.content + '\n';
      } else {
        const decision = decisions[s.id];
        if (decision === 'current') resolved += s.current + '\n';
        else if (decision === 'incoming') resolved += s.incoming + '\n';
        else if (decision === 'both') resolved += s.current + '\n' + s.incoming + '\n';
      }
    });
    onResolve(filePath, resolved.trim());
  };

  const allResolved = sections.every(s => s.type === 'text' || decisions[s.id] !== null);
  const hasConflicts = content.includes('<<<<<<<');

  return (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-yellow-400">
            {hasConflicts ? `Conflict Resolution: ${filePath}` : `File Preview: ${filePath}`}
        </h3>
        <div className="space-x-2">
          <button onClick={onCancel} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white">
            {hasConflicts ? 'Cancel' : 'Close'}
          </button>
          {hasConflicts && (
            <button 
                onClick={handleComplete} 
                disabled={!allResolved}
                className={`px-3 py-1 rounded flex items-center gap-2 ${allResolved ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
            >
                <Check size={16} /> Complete Merge
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            {section.type === 'text' ? (
              <pre className="text-gray-400 whitespace-pre-wrap">{section.content}</pre>
            ) : (
              <div className="border border-yellow-600 rounded overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-gray-700">
                  {/* Current Changes Panel */}
                  <div className={`p-2 ${decisions[section.id] === 'current' || decisions[section.id] === 'both' ? 'bg-green-900/30' : 'bg-gray-800/50'}`}>
                    <div className="text-xs text-green-400 mb-1 font-bold">Current Change (HEAD)</div>
                    <pre className="whitespace-pre-wrap text-gray-300">{section.current}</pre>
                    <button 
                      onClick={() => handleDecision(section.id, 'current')}
                      className={`mt-2 w-full py-1 text-xs rounded border ${decisions[section.id] === 'current' ? 'bg-green-600 border-green-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      Accept Current
                    </button>
                  </div>

                  {/* Incoming Changes Panel */}
                  <div className={`p-2 ${decisions[section.id] === 'incoming' || decisions[section.id] === 'both' ? 'bg-blue-900/30' : 'bg-gray-800/50'}`}>
                    <div className="text-xs text-blue-400 mb-1 font-bold">Incoming Change</div>
                    <pre className="whitespace-pre-wrap text-gray-300">{section.incoming}</pre>
                    <button 
                      onClick={() => handleDecision(section.id, 'incoming')}
                      className={`mt-2 w-full py-1 text-xs rounded border ${decisions[section.id] === 'incoming' ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      Accept Incoming
                    </button>
                  </div>
                </div>
                <div className="p-2 bg-gray-800 border-t border-gray-700 text-center">
                   <button 
                      onClick={() => handleDecision(section.id, 'both')}
                      className={`w-full py-1 text-xs rounded border ${decisions[section.id] === 'both' ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-600 hover:bg-gray-700 text-gray-400'}`}
                    >
                      Accept Both
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
