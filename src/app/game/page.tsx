'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { GitEngine, type ConflictResolutionSession } from '@/engine/git-simulator';
import { GitGraph } from '@/components/git-graph';
import { ConflictSolver } from '@/components/conflict-solver';
import { FileTree } from '@/components/file-tree';
import { FilePreview } from '@/components/file-preview';
import { GitState, Scenario, CommandResult } from '@/types/git';
import { scenarios } from '@/engine/scenarios';
import { assessGoal } from '@/engine/goal-checker';
import { ProgressStore, PROGRESS_PREFIX } from '@/learning/progress';
import { lessonHints } from '@/learning/hints';
import { operationGuidance } from '@/learning/operation-guidance';
import { Terminal, Play, RotateCcw, BookOpen, CheckCircle, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

interface TerminalLine {
  type: 'command' | 'success' | 'error' | 'info';
  content: string;
}

const chapterNames = ['基本操作', 'ブランチ', 'マージ', '作業の退避', '取り消し', '過去の調査', 'コンフリクト'];
const scenarioCategory = (scenario: Scenario) => scenario.category ?? chapterNames[Number(scenario.id.match(/^level-(\d+)/)?.[1]) - 1] ?? 'その他';
const categories = [...new Set(scenarios.map(scenarioCategory))];

/**
 * Main Application Component
 * 
 * Manages the global state of the Git simulator, handles user input,
 * and renders the main UI layout including Terminal, Visualizer, and Scenario list.
 */
const subscribeHydration = () => () => {};
export default function Game() {
  const ready = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return ready ? <LearningSession /> : <main className="min-h-screen bg-gray-950 text-gray-100 p-4" aria-busy="true">学習画面を読み込み中…</main>;
}

function LearningSession() {
  const [saved] = useState(() => {
    try {
      const store = new ProgressStore(window.localStorage, new Set(scenarios.map(item => item.id)), new Set(categories));
      return { store, snapshot: store.snapshot() };
    } catch {
      return { store: null, snapshot: { lastId: null, category: 'all', search: '', completed: new Map<string, number>(), hints: new Map<string, number>(), warnings: ['ブラウザの保存領域にアクセスできません。保存の許可を確認してください。この画面では学習を続けられます。'] } };
    }
  });
  const initialScenario = scenarios.find(item => item.id === saved.snapshot.lastId) ?? null;
  // GitEngineを初期化。一度だけ作成されるようにlazy initializerを使用。
  const [engine] = useState(() => new GitEngine(initialScenario?.initialState));
  
  // 描画用のGit状態を追跡するReactステート
  const [state, setState] = useState<GitState>(() => engine.getState());
  
  // ターミナル出力行
  const [output, setOutput] = useState<TerminalLine[]>(initialScenario ? [
    { type: 'info', content: `Loaded: ${initialScenario.title}` },
    { type: 'info', content: initialScenario.description }
  ] : [
    { type: 'info', content: 'Welcome to Git Learning App!' },
    { type: 'info', content: 'Select a level to start.' }
  ]);
  
  // 現在のコマンド入力
  const [input, setInput] = useState('');
  
  // コマンド履歴
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // 現在アクティブなシナリオ
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(initialScenario);
  
  // シナリオのゴールが達成されたかを示すフラグ
  const [isGoalMet, setIsGoalMet] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set(saved.snapshot.completed.keys()));
  const [resolvingFile, setResolvingFile] = useState<ConflictResolutionSession | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<{ command: string; result: CommandResult } | null>(null);
  const [saveError, setSaveError] = useState(saved.snapshot.warnings.join(' '));
  const [notice, setNotice] = useState({ text: '', count: 0 });
  const [deleteScope, setDeleteScope] = useState<'all' | 'current' | null>(null);
  const storeRef = useRef<ProgressStore | null>(saved.store);
  const pendingCompletions = useRef(new Map<string, number>());
  const pendingHints = useRef(new Map<string, number>());
  const commandRef = useRef<HTMLInputElement>(null);
  const filePanelRef = useRef<HTMLDivElement>(null);
  const fileReturnPath = useRef<string | null>(null);
  const composing = useRef(false);
  const focusPanel = useRef(false);
  const focusReturn = useRef(false);
  const notify = (text: string) => setNotice(previous => ({ text, count: previous.count + 1 }));
  const [category, setCategory] = useState(saved.snapshot.category);
  const [search, setSearch] = useState(saved.snapshot.search);
  const query = search.trim().toLocaleLowerCase();
  const visibleScenarios = scenarios.filter(scenario =>
    (category === 'all' || scenarioCategory(scenario) === category) &&
    (!query || [scenario.title, scenario.description, ...scenario.hints].join(' ').toLocaleLowerCase().includes(query))
  );
  
  const assessment = currentScenario ? assessGoal(state, currentScenario, lastAttempt?.command, lastAttempt?.result) : null;
  const guidance = operationGuidance(state);
  const hints = currentScenario ? lessonHints(currentScenario) : [];

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
        disableForReducedMotion: true,
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
  const loadScenario = useCallback((scenario: Scenario) => {
    setHintLevel(0);
    setLastAttempt(null);
    setDeleteScope(null);
    setCurrentScenario(scenario);
    setIsGoalMet(false);
    setInput('');
    setSelectedFile(null);
    setResolvingFile(null);
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
      { type: 'info', content: scenario.description }
    ]);
    setHistory([]);
    setHistoryIndex(-1);
  }, [engine]);


  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || (event.key !== null && !event.key.startsWith(PROGRESS_PREFIX))) return;
      const snapshot = storeRef.current?.snapshot();
      if (snapshot) {
        // Read the current disk, not event.newValue: queued events may already be stale.
        setCompletedIds(new Set([...snapshot.completed.keys(), ...pendingCompletions.current.keys()]));
        if (snapshot.warnings.length) setSaveError(snapshot.warnings.join(' '));
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const saveSelection = (id: string | null, nextCategory = category, nextSearch = search) => {
    const error = storeRef.current?.select({ lastId: id, category: nextCategory, search: nextSearch });
    if (error) setSaveError(error);
  };
  const chooseScenario = (scenario: Scenario) => {
    loadScenario(scenario);
    saveSelection(scenario.id);
    notify(`${scenario.title} を初期状態から開始しました。`);
    commandRef.current?.focus();
  };
  const recordCompletion = (scenario: Scenario) => {
    setIsGoalMet(true);
    setCompletedIds(previous => new Set(previous).add(scenario.id));
    const timestamp = Date.now();
    const error = storeRef.current?.complete(scenario.id, timestamp) ?? (storeRef.current ? null : '保存領域を利用できません。保存を再試行してください。');
    if (error) {
      pendingCompletions.current.set(scenario.id, timestamp);
      setSaveError(error);
    } else pendingCompletions.current.delete(scenario.id);
    notify(`${scenario.title} の達成条件を満たしました。${error ? '完了記録の保存は失敗しました。' : '完了記録を保存しました。'}`);
  };
  const retrySaving = () => {
    try {
      if (!storeRef.current) storeRef.current = new ProgressStore(window.localStorage, new Set(scenarios.map(item => item.id)), new Set(categories));
      const errors: string[] = [];
      const selectionError = storeRef.current.select({ lastId: currentScenario?.id ?? null, category, search });
      if (selectionError) errors.push(selectionError);
      for (const [id, timestamp] of pendingCompletions.current) {
        const error = storeRef.current.complete(id, timestamp);
        if (error) errors.push(error); else pendingCompletions.current.delete(id);
      }
      for (const [id, level] of pendingHints.current) {
        const error = storeRef.current.reveal(id, level);
        if (error) errors.push(error); else pendingHints.current.delete(id);
      }
      errors.push(...storeRef.current.snapshot().warnings);
      setSaveError([...new Set(errors)].join(' '));
      notify(errors.length ? '保存を再試行しましたが、未保存の記録があります。' : '保存を再試行しました。');
    } catch { setSaveError('保存領域にアクセスできません。ブラウザの保存設定を確認してください。'); }
  };
  const deleteRecords = () => {
    const id = deleteScope === 'current' ? currentScenario?.id : undefined;
    const error = storeRef.current?.clear(id) ?? (storeRef.current ? null : '保存領域にアクセスできません。');
    if (error) { setSaveError(error); return; }
    if (id) {
      pendingCompletions.current.delete(id);
      pendingHints.current.delete(id);
      setCompletedIds(previous => { const next = new Set(previous); next.delete(id); return next; });
    } else {
      pendingCompletions.current.clear();
      pendingHints.current.clear();
      setCompletedIds(new Set());
    }
    setSaveError('');
    setDeleteScope(null);
    notify('保存記録を削除しました。現在のGit状態はそのままです。');
    commandRef.current?.focus();
  };
  const openHint = () => {
    if (!currentScenario || hintLevel >= 4) return;
    const next = hintLevel + 1;
    setHintLevel(next);
    const error = storeRef.current?.reveal(currentScenario.id, next) ?? (storeRef.current ? null : 'ヒント利用を保存できません。保存を再試行してください。');
    if (error) { pendingHints.current.set(currentScenario.id, next); setSaveError(error); }
    else pendingHints.current.delete(currentScenario.id);
  };



  /**
   * Handles submission of git commands from the terminal input.
   */
  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (composing.current || !input.trim()) return;

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
    let result: CommandResult;
    const before = engine.getState();
    try { result = engine.execute(cmd); }
    catch {
      engine.loadState(before);
      result = { success: false, message: '予期しないエラーが起きたため、このコマンドの直前へ戻しました。入力を確認するか演習をリセットしてください。' };
    }
    setLastAttempt({ command: cmd, result });
    if (result.message) {
      setOutput(prev => [...prev, { type: result.success ? 'success' : 'error', content: result.message }]);
    }

    // Conflicts can change files even when the command reports failure.
    const nextState = engine.getState();
    setState(nextState);
    if (nextState.activeWorktree !== state.activeWorktree) setSelectedFile(null);
    if (resolvingFile && !engine.isConflictResolutionCurrent(resolvingFile)) setResolvingFile(null);
    if (currentScenario && !isGoalMet && assessGoal(nextState, currentScenario, cmd, result).met) {
      recordCompletion(currentScenario);
      setOutput(prev => [...prev, { type: 'success', content: '🎉 Goal Met! Great job!' }]);
    } else if (!result.success) {
      notify(guidance?.title !== operationGuidance(nextState)?.title && operationGuidance(nextState)
        ? `${operationGuidance(nextState)!.title}。状態と復旧方法を確認してください。`
        : `コマンドが失敗しました。${result.message.split('\n')[0].slice(0, 180)}`);
    } else if (guidance?.title !== operationGuidance(nextState)?.title) {
      notify(operationGuidance(nextState) ? `${operationGuidance(nextState)!.title}。状態案内を確認してください。` : '進行中の操作が終了しました。');
    }

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
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

  const previewFile = selectedFile === null ? null : { path: selectedFile, content: state.workingDirectory[selectedFile] };

  /**
   * UIでコンフリクトが解消されたときのコールバック。
   * ワーキングディレクトリを解消された内容で更新します。
   */
  const handleResolve = (path: string, resolvedContent: string) => {
    if (!resolvingFile || resolvingFile.path !== path) return;
    const result = engine.resolveConflict(resolvingFile, resolvedContent);
    setResolvingFile(null);
    setOutput(prev => [...prev, { type: result.success ? 'success' : 'error', content: result.message }]);
    if (!result.success) { notify(result.message); focusReturn.current = true; return; }
    setState(engine.getState());
    setLastAttempt({ command: '', result });
    notify(result.success ? '競合の解決内容を適用しました。stageと続行の条件を確認してください。' : result.message);
    if (currentScenario && !isGoalMet && assessGoal(engine.getState(), currentScenario, '', result).met) recordCompletion(currentScenario);
    focusReturn.current = true;
  };

  const closeFile = () => {
    setSelectedFile(null);
    setResolvingFile(null);
    focusReturn.current = true;
  };
  useEffect(() => {
    if (focusPanel.current) {
      filePanelRef.current?.querySelector<HTMLElement>('button')?.focus();
      focusPanel.current = false;
    } else if (focusReturn.current) {
      const target = [...(filePanelRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(button => button.getAttribute('aria-label') === `${fileReturnPath.current}を開く`);
      (target ?? commandRef.current)?.focus();
      focusReturn.current = false;
    }
  }, [selectedFile, resolvingFile]);

  return (
    <main className="flex flex-col min-h-screen lg:flex-row lg:h-screen bg-gray-950 text-gray-100 font-sans lg:overflow-hidden">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only"><span key={notice.count}>{notice.text}</span></div>
      {/* サイドバー: シナリオ */}
      <aside aria-label="学習する演習" className="lg:w-72 lg:shrink-0 max-h-96 lg:max-h-none bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2 font-bold text-lg text-blue-400">
          <BookOpen className="w-5 h-5" />
          演習を選ぶ
        </div>
        <div className="p-3 space-y-3 border-b border-gray-800">
          <div>
            <label htmlFor="course-category" className="block mb-1 text-sm text-gray-300">学習コース</label>
            <select id="course-category" value={category} onChange={event => { setCategory(event.target.value); saveSelection(currentScenario?.id ?? null, event.target.value); }} className="w-full min-h-11 bg-gray-950 text-gray-100 border border-gray-700 rounded px-2 focus-visible:outline-2 focus-visible:outline-blue-400">
              <option value="all">すべてのコース</option>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="exercise-search" className="block mb-1 text-sm text-gray-300">演習を検索</label>
            <input id="exercise-search" type="search" value={search} maxLength={512} onChange={event => { setSearch(event.target.value); saveSelection(currentScenario?.id ?? null, category, event.target.value); }} placeholder="操作やコマンド名" className="w-full min-h-11 bg-gray-950 text-gray-100 placeholder:text-gray-400 border border-gray-700 rounded px-3 focus-visible:outline-2 focus-visible:outline-blue-400" />
          </div>
          <p aria-live="polite" className="text-xs text-gray-300">{visibleScenarios.length} / {scenarios.length} 演習 · {completedIds.size} 完了</p>
        </div>
        <details className="p-3 border-b border-gray-800 text-sm">
          <summary className="min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-400">保存と再開</summary>
          <p className="text-gray-300 mb-2">このブラウザに完了日時・ヒント利用・最後の演習と絞り込みを保存します。再読み込み後は演習選択を復元し、Gitの途中状態と端末履歴は初期状態から再開します。</p>
          <p className="text-gray-300 mb-2">演習のリセットは保存記録を消しません。別タブの完了・削除は一覧に反映します。別タブの演習選択で現在の演習は切り替わりません。</p>
          <div className="flex flex-wrap gap-2">
            <button disabled={!currentScenario} onClick={() => setDeleteScope('current')} className="min-h-11 px-2 border border-gray-600 rounded disabled:opacity-50">この演習の保存記録を削除</button>
            <button onClick={() => setDeleteScope('all')} className="min-h-11 px-2 border border-gray-600 rounded">すべての保存記録を削除</button>
          </div>
          {deleteScope ? <div className="mt-2">
            <p>{deleteScope === 'all' ? 'すべての完了・ヒント・演習選択' : '現在の演習の完了・ヒント'}の記録を削除します。現在のGit状態は変わりません。</p>
            <button onClick={deleteRecords} className="min-h-11 px-3 text-red-300">削除する</button>
            <button onClick={() => { setDeleteScope(null); commandRef.current?.focus(); }} className="min-h-11 px-3">キャンセル</button>
          </div> : null}
        </details>
        {saveError ? <div className="p-3 text-sm text-amber-200 border-b border-gray-800">
          <p role="alert">{saveError}</p>
          <button onClick={retrySaving} className="min-h-11 underline">保存を再試行</button>
        </div> : null}
        <div className="flex-1 min-h-20 overflow-auto p-2 space-y-2">
          {visibleScenarios.length === 0 ? <p className="p-3 text-sm text-gray-300">該当する演習がありません。検索語やコースを変更してください。</p> : null}
          {visibleScenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => chooseScenario(scenario)}
              aria-pressed={currentScenario?.id === scenario.id}
              className={clsx(
                "w-full text-left p-3 rounded-lg text-sm transition-colors border focus-visible:outline-2 focus-visible:outline-blue-400",
                currentScenario?.id === scenario.id 
                  ? "bg-blue-900/30 border-blue-500/50 text-blue-200" 
                  : "bg-gray-800/50 border-transparent hover:bg-gray-800 text-gray-300 hover:text-gray-100"
              )}
            >
              <div className="font-bold mb-1">{scenario.title}</div>
              {completedIds.has(scenario.id) ? <span className="text-xs text-green-300">完了済み</span> : null}
              <div className="text-xs opacity-70 line-clamp-2">{scenario.description}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* 中央パネル: ターミナル */}
      <div className="lg:w-2/5 min-w-0 h-[36rem] lg:h-auto flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800">
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            <h1 className="font-bold text-lg">Terminal</h1>
          </div>
          <button 
            onClick={() => { if (currentScenario) { loadScenario(currentScenario); notify("演習を初期状態にリセットしました。保存記録は保持しています。"); commandRef.current?.focus(); } else { engine.loadState(new GitEngine().getState()); setState(engine.getState()); setSelectedFile(null); setResolvingFile(null); setLastAttempt(null); setOutput([]); setInput(''); setHistory([]); setHistoryIndex(-1); notify("自由練習をリセットしました。"); commandRef.current?.focus(); } }}
            aria-label="現在の演習を最初からやり直す"
            className="min-w-11 min-h-11 flex items-center justify-center p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
            title="演習をやり直す"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        {state.activeWorktree ? <p className="px-4 py-2 text-xs font-mono text-gray-300 break-all border-b border-gray-800">仮想作業場所: {state.activeWorktree}</p> : null}

        <div className="min-h-0 flex-1 overflow-auto flex flex-col">
        {/* ターミナル内のシナリオ情報オーバーレイ */}
        {currentScenario && (
          <div className="bg-blue-900/20 border-b border-blue-500/20 p-3 text-sm">
            <div className="font-bold text-blue-300 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              達成条件:
            </div>
            <p className="text-gray-300 mt-1">{currentScenario.description}</p>
            <ul aria-label="達成条件" className="mt-2 space-y-1">
              {assessment?.conditions.map(condition => <li key={condition.id} className="break-words">
                <span className={condition.met ? 'text-green-300' : 'text-gray-300'}>{condition.met ? '達成' : '未達'}: {condition.label}</span>
              </li>)}
            </ul>
            <div className="mt-3">
              <p className="text-gray-300">ヒントは必要なときだけ開けます。</p>
              {hints.slice(0, hintLevel).map((hint, index) => <div key={hint.title} id={`hint-${index}`} className="mt-2">
                <h2 className="font-bold text-blue-200">{index + 1}. {hint.title}</h2>
                <p className="whitespace-pre-wrap break-words text-gray-300">{hint.text}</p>
              </div>)}
              <button onClick={openHint} disabled={hintLevel >= 4} aria-expanded={hintLevel > 0} className="min-h-11 mt-1 px-3 border border-blue-500/50 rounded text-blue-200 disabled:opacity-50">{hintLevel < 4 ? `ヒント ${hintLevel + 1}: ${hints[hintLevel]?.title}を開く` : 'すべてのヒントを表示中'}</button>
            </div>
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

        {guidance ? <section aria-label="操作中の状態" className="p-3 border-b border-gray-700 text-sm space-y-2">
          <h2 className="font-bold text-amber-200">{guidance.title}</h2>
          <p className="text-gray-300 break-words">{guidance.detail}</p>
          <p className="text-gray-300">入力候補を選び、内容を確認してEnterで実行します。</p>
          <div className="flex flex-wrap gap-2">{guidance.commands.map(command => <button key={command} onClick={() => { setInput(command); commandRef.current?.focus(); }} className="min-h-11 px-2 rounded border border-gray-600 text-gray-100 font-mono break-all text-left">{command}</button>)}</div>
        </section> : null}
        {state.operation?.awaiting === 'todo' ? (
          <div className="p-3 border-b border-gray-700 space-y-2">
            <label htmlFor="rebase-todo" className="block font-bold text-sm">コミットの整理</label>
            <p className="text-sm text-gray-300">pick / reword / edit / squash / fixup / drop を指定し、行を並べ替えられます。</p>
            <textarea id="rebase-todo" value={state.operation.todo ?? ''} onChange={event => { engine.setRebaseTodo(event.target.value); setState(engine.getState()); }} rows={4} spellCheck={false} className="w-full bg-gray-950 text-gray-100 border border-gray-700 rounded p-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-blue-400" />
            <p className="text-sm text-gray-300">編集後に git rebase --continue を実行してください。</p>
          </div>
        ) : null}
        <div className="flex-1 min-h-32 overflow-auto p-4 font-mono text-sm space-y-2 bg-black/50">
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

        </div>
        <form onSubmit={handleCommand} className="p-4 bg-gray-900 border-t border-gray-800">
          <div className="flex-1 flex items-center gap-2 bg-black rounded px-3 py-2 border border-gray-700 focus-within:border-blue-500 transition-colors">
            <span className="text-green-400">$</span>
            <input
              ref={commandRef}
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={() => { composing.current = false; }}
              aria-label="演習コマンド"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 bg-transparent outline-none font-mono text-base placeholder:text-gray-400"
              placeholder={state.patchSession ? 'y / n / q を入力' : 'git status などを入力'}
            />
          </div>
        </form>
      </div>

      {/* 右パネル: 可視化とファイル */}
      <div className="flex-1 min-w-0 h-[36rem] lg:h-auto flex flex-col bg-gray-900">
        <div className="h-2/3 flex flex-col border-b border-gray-800">
          <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
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
            <span className="text-xs normal-case text-gray-300">
              <span className="text-yellow-500">●</span> Mod
              <span className="text-green-500 ml-2">●</span> Staged
              <span className="text-red-500 ml-2">●</span> Conflict
            </span>
          </div>
          <div ref={filePanelRef} onKeyDown={event => { if (event.key === "Escape" && (selectedFile || resolvingFile)) { event.preventDefault(); closeFile(); } }} className="flex-1 overflow-auto">
            {resolvingFile && engine.isConflictResolutionCurrent(resolvingFile) ? (
              <ConflictSolver 
                key={`${resolvingFile.path}:${resolvingFile.revision}`}
                filePath={resolvingFile.path} 
                content={resolvingFile.content} 
                onResolve={handleResolve} 
                onCancel={closeFile}
              />
            ) : previewFile ? (
              <FilePreview
                file={previewFile}
                onClose={closeFile}
              />
            ) : null}
            <div hidden={!!resolvingFile || !!previewFile}>
              <FileTree 
                state={state} 
                onFileClick={(path) => {
                  fileReturnPath.current = path;
                  focusPanel.current = true;
                  if (state.workingDirectory[path]?.includes('<<<<<<<')) {
                    setResolvingFile(engine.openConflictResolution(path));
                    setSelectedFile(null);
                  } else {
                    setSelectedFile(path);
                    setResolvingFile(null);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
