'use client';
import { useState } from 'react';
import Link from 'next/link';
import { commandHelp, supportedCommands } from '@/engine/command-input';

const glossary = [
  ['HEAD・index・作業ツリー', 'HEADは現在のコミット、index（ステージ）は次のコミットの候補、作業ツリーは編集している内容です。addは作業ツリーからindexへ、commitはindexから履歴へ記録します。'],
  ['mergeとrebase', 'mergeは両方の履歴を統合します。rebaseは変更を別の基点へ載せ替え、新しいコミットを作ります。共有済み履歴の書き換えには合意が必要です。'],
  ['resetとrevert', 'resetは参照と、モードに応じてindex・作業ツリーを動かします。revertは取り消す変更を新しいコミットに記録します。'],
  ['fetchとpull', 'fetchはリモート追跡参照を更新します。pullは取得したうえで現在のブランチへmergeまたはrebaseします。'],
  ['stash applyとpop', 'applyは保管を残して復元し、popは復元に成功すると保管を削除します。競合したpopでは保管が残ります。'],
];
const questions = [
  { text: 'addした後に同じファイルを再編集し、commitしました。記録されるのは？', choices: ['最後にaddした時点の内容', '現在の作業ツリーの全内容', 'HEADと作業ツリーの両方'], answer: 0, reason: 'commitが記録するのはindexです。再編集した内容は、もう一度addするまで作業ツリーにだけ残ります。' },
  { text: 'チームで共有したコミットを取り消し、履歴を残したいときは？', choices: ['reset --hard', 'revert', 'ブランチ名の変更'], answer: 1, reason: 'revertは逆の変更を新しいコミットにします。共有済み参照を書き換える操作との違いを確認しましょう。' },
  { text: 'fetch直後、現在のローカルブランチはどうなる？', choices: ['必ずリモートと同じになる', '未コミット変更が消える', '参照を取得するだけで、自動統合しない'], answer: 2, reason: 'fetchはリモート追跡参照を更新します。統合はmergeやrebaseで別に行います。' },
  { text: 'PRの承認とCI成功の後に修正をpushしました。このアプリでは？', choices: ['新しいコミットへの承認・CIが必要', '前の承認・CIでそのままマージできる', 'PRは自動で閉じる'], answer: 0, reason: 'この模擬環境は最新コミットへの承認とCIを要求します。実GitHubではリポジトリの保護設定にも依存します。' },
  { text: 'reflogで通常は救出できないものは？', choices: ['reset前のコミット', '一度もコミットせずhard resetで失った編集', 'Detached HEADで作ったコミット'], answer: 1, reason: 'reflogは参照移動の記録です。未コミットの編集を一般的に復元するバックアップではありません。' },
  { text: '競合マーカーを消して内容を編集した後、続行前に必要な操作は？', choices: ['必ずpush --force', 'git init', '内容を確認してgit addで解消を記録'], answer: 2, reason: '内容の編集と、未解消パスをindexで解消済みにする操作は別です。statusで確認して続行します。' },
];
export function LearningReference() {
  const [command, setCommand] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  return <details className="p-3 border-b border-gray-800 text-sm space-y-3">
    <summary tabIndex={0} className="min-h-11 cursor-pointer">操作リファレンス・理解度チェック</summary>
    <label className="block">対応コマンド<select aria-label="コマンドリファレンス" value={command} onChange={event => setCommand(event.target.value)} className="block w-full min-h-11 bg-gray-950 border rounded"><option value="">一覧・制約</option>{supportedCommands.map(name => <option key={name}>{name}</option>)}</select></label>
    <p className="whitespace-pre-wrap break-words">{commandHelp(command || undefined)}</p>
    {glossary.map(([term, explanation]) => <details key={term}><summary tabIndex={0} className="min-h-11 cursor-pointer">{term}</summary><p>{explanation}</p></details>)}
    <h2 className="font-bold">理解度チェック</h2><p>演習の完了とは別に、操作の結果を考えて答えます。</p>
    {questions.map((question, index) => <fieldset key={question.text} className="border border-gray-600 rounded p-2"><legend>{index + 1}. {question.text}</legend>{question.choices.map((choice, value) => <label key={choice} className="flex gap-2 items-center min-h-11"><input type="radio" name={`question-${index}`} checked={answers[index] === value} onChange={() => setAnswers(previous => ({ ...previous, [index]: value }))} />{choice}</label>)}{answers[index] !== undefined ? <p role="status">{answers[index] === question.answer ? '正解。' : 'もう一度考えてみましょう。'}{question.reason}</p> : null}</fieldset>)}
    <p>正解: {questions.filter((question, index) => answers[index] === question.answer).length} / {questions.length}</p>
    <button tabIndex={0} className="min-h-11 underline" onClick={() => setAnswers({})}>確認問題をやり直す</button>
    <Link tabIndex={0} className="block min-h-11 text-blue-200 underline" href="/real-git">自分のPCの実Gitで練習する</Link>
  </details>;
}
