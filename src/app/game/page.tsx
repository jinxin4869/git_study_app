'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GitEngine } from '@/engine/git-simulator';
import { GitGraph } from '@/components/git-graph';
import { ConflictSolver } from '@/components/conflict-solver';
import { FileTree } from '@/components/file-tree';
import { FilePreview } from '@/components/file-preview';
import { GitState, Scenario } from '@/types/git';
import { scenarios } from '@/engine/scenarios';
import { checkGoal } from '@/engine/goal-checker';
import { Terminal, Play, RotateCcw, BookOpen, CheckCircle, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

interface TerminalLine {
  type: 'command' | 'success' | 'error' | 'info';
  content: string;
}

/**
 * Main Application Component
 * 
 * Manages the global state of the Git simulator, handles user input,
 * and renders the main UI layout including Terminal, Visualizer, and Scenario list.
 */
export default function Game() {
  // GitEngineを初期化。一度だけ作成されるようにlazy initializerを使用。
  const [engine] = useState(() => new GitEngine());
  
  // 描画用のGit状態を追跡するReactステート
  const [state, setState] = useState<GitState>(engine.getState());
  
  // ターミナル出力行
  const [output, setOutput] = useState<TerminalLine[]>([
    { type: 'info', content: 'Welcome to Git Learning App!' },
    { type: 'info', content: 'Select a level to start.' }
  ]);
  
  // 現在のコマンド入力
  const [input, setInput] = useState('');
  
  // コマンド履歴
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // 現在アクティブなシナリオ
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  
  // シナリオのゴールが達成されたかを示すフラグ
  const [isGoalMet, setIsGoalMet] = useState(false);
  
  // ターミナルの自動スクロール用Ref
  const bottomRef = useRef<HTMLDivElement>(null);

  // 出力が変更されたらターミナルの最下部にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // ゴール達成時に紙吹雪を飛ばす
  useEffect(() => {
    if (isGoalMet) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isGoalMet]);

  /**
   * 特定のシナリオをエンジンにロードします。
   * 状態をシナリオの初期状態にリセットします。
   */
  const loadScenario = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    setIsGoalMet(false);
    if (scenario.initialState) {
      engine.loadState(scenario.initialState);
    } else {
      // 初期状態が提供されていない場合、クリーンな空のリポジトリにリセット
      const emptyState = new GitEngine().getState();
      engine.loadState(emptyState);
    }
    setState(engine.getState());
    setOutput([
      { type: 'info', content: `Loaded: ${scenario.title}` },
      { type: 'info', content: scenario.description },
      ...scenario.hints.map(h => ({ type: 'info', content: `Hint: ${h}` } as TerminalLine))
    ]);
    setHistory([]);
    setHistoryIndex(-1);
  };



  /**
   * Handles submission of git commands from the terminal input.
   */
  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim();
    setOutput(prev => [...prev, { type: 'command', content: `$ ${cmd}` }]);
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1); // Reset history index

    if (cmd === 'clear') {
      setOutput([]);
      setInput('');
      return;
    }

    // コマンド実行
    const result = engine.execute(cmd);
    if (result.message) {
      setOutput(prev => [...prev, { type: result.success ? 'success' : 'error', content: result.message }]);
    }

    // コマンドが成功し、状態が変更された場合にステートを更新
    if (result.success && result.newState) {
      setState(result.newState);
      
      // ゴール達成を確認
      if (currentScenario) {
        // チェック用にコマンド名を抽出
        const cmdName = cmd.split(' ')[0];
        const gitCmd = cmdName === 'git' ? cmd.split(' ')[1] : cmdName;
        
        if (checkGoal(result.newState, currentScenario, gitCmd)) {
          setIsGoalMet(true);
          setOutput(prev => [...prev, { type: 'success', content: '🎉 Goal Met! Great job!' }]);
        }
      }
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || historyIndex === -1) return;
      
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    }
  };

  // 現在コンフリクト解消中のファイルの状態
  const [resolvingFile, setResolvingFile] = useState<{path: string, content: string} | null>(null);
  
  // プレビュー中のファイルの状態
  const [selectedFile, setSelectedFile] = useState<{path: string, content: string} | null>(null);

  /**
   * UIでコンフリクトが解消されたときのコールバック。
   * ワーキングディレクトリを解消された内容で更新します。
   */
  const handleResolve = (path: string, resolvedContent: string) => {
    engine.touch(path, resolvedContent);
    setState(engine.getState());
    setResolvingFile(null);
    setOutput(prev => [...prev, { type: 'success', content: `Resolved conflict in ${path}` }]);
  };

  return (
    <main className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* サイドバー: シナリオ */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2 font-bold text-lg text-blue-400">
          <BookOpen className="w-5 h-5" />
          Levels
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => loadScenario(scenario)}
              className={clsx(
                "w-full text-left p-3 rounded-lg text-sm transition-colors border",
                currentScenario?.id === scenario.id 
                  ? "bg-blue-900/30 border-blue-500/50 text-blue-200" 
                  : "bg-gray-800/50 border-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200"
              )}
            >
              <div className="font-bold mb-1">{scenario.title}</div>
              <div className="text-xs opacity-70 line-clamp-2">{scenario.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 中央パネル: ターミナル */}
      <div className="w-1/3 flex flex-col border-r border-gray-800 min-w-[400px]">
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            <h1 className="font-bold text-lg">Terminal</h1>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
            title="Reset App"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* ターミナル内のシナリオ情報オーバーレイ */}
        {currentScenario && (
          <div className="bg-blue-900/20 border-b border-blue-500/20 p-3 text-sm">
            <div className="font-bold text-blue-300 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Goal:
            </div>
            <p className="text-gray-300 mt-1">{currentScenario.description}</p>
            {isGoalMet && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 p-2 bg-green-500/20 text-green-300 rounded flex items-center gap-2 font-bold"
              >
                <CheckCircle className="w-4 h-4" />
                Level Completed!
              </motion.div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 font-mono text-sm space-y-2 bg-black/50">
          {output.map((line, i) => (
              <motion.div 
                key={i} 
                className={`whitespace-pre-wrap break-words ${line.type === 'error' ? 'text-red-400' : line.type === 'success' || line.type === 'command' || line.type === 'info' ? 'text-green-400' : 'text-gray-300'}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
              >
                {line.content}
              </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleCommand} className="p-4 bg-gray-900 border-t border-gray-800">
          <div className="flex-1 flex items-center gap-2 bg-black rounded px-3 py-2 border border-gray-700 focus-within:border-blue-500 transition-colors">
            <span className="text-green-400">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none font-mono text-sm"
              placeholder="Type git command..."
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* 右パネル: 可視化とファイル */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="h-2/3 flex flex-col border-b border-gray-800">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Play className="w-5 h-5 text-purple-400" />
              Visualizer
            </h2>
            <div className="flex gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span> Commit
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span> Branch
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span> HEAD
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative overflow-hidden bg-gray-950/50">
            <GitGraph state={state} />
            
            {Object.keys(state.commits).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                <p>Waiting for commits...</p>
              </div>
            )}
          </div>
        </div>

        {/* ワーキングディレクトリ / ファイルリスト */}
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
          <div className="p-3 border-b border-gray-800 font-bold text-sm text-gray-400 uppercase tracking-wider flex justify-between items-center">
            <span>Working Directory</span>
            <span className="text-xs normal-case text-gray-600">
              <span className="text-yellow-500">●</span> Mod
              <span className="text-green-500 ml-2">●</span> Staged
              <span className="text-red-500 ml-2">●</span> Conflict
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            {resolvingFile ? (
              <ConflictSolver 
                key={resolvingFile.path}
                filePath={resolvingFile.path} 
                content={resolvingFile.content} 
                onResolve={handleResolve} 
                onCancel={() => setResolvingFile(null)} 
              />
            ) : selectedFile ? (
              <FilePreview
                file={selectedFile}
                onClose={() => setSelectedFile(null)}
              />
            ) : (
              <FileTree 
                state={state} 
                onFileClick={(path, content) => {
                  if (content.includes('<<<<<<<')) {
                    setResolvingFile({ path, content });
                    setSelectedFile(null);
                  } else {
                    setSelectedFile({ path, content });
                    setResolvingFile(null);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
