/** Recovery limits, separate from the simulator's ability to retain old objects. */
export const recoveryCases = [
  { situation: 'コミットした後にreset・ブランチ削除', possible: '記録が残っていればreflogからコミットを探し、ブランチで保護できる', limit: '実Gitではreflogの期限やオブジェクト削除がある。永久保存ではない' },
  { situation: '一度も記録せず、未コミット編集を破棄', possible: '先に作ったstash・別バックアップがあればその保存時点を確認する', limit: 'reflogは作業ファイルの編集履歴ではない。未記録の最新版を戻せるとは限らない' },
  { situation: '未追跡ファイルをcleanで削除する前', possible: 'git clean -n -dで削除候補を確認し、必要なファイルを別に保管する', limit: 'dry-runは削除もバックアップもしない。このアプリは実削除に非対応' },
  { situation: 'このアプリの明示checkpoint', possible: '保存ボタンを押した時点の模擬Git・端末履歴を再開する', limit: '保存後の入力や未適用の編集は含まない。実リポジトリを保存する機能ではない' },
];
export const recoveryQuestions = [
  { text: 'git clean -n -dで必要な未追跡ファイルが候補に出ました。次にどうする？', choices: ['reflogが必ず保存するので削除する', '必要な内容を別に保管してから削除の要否を判断する', 'dry-runした時点でバックアップ済み'], answer: 1, reason: 'dry-runは候補の表示だけです。未追跡の内容をGitが必ず記録しているとは限らず、削除前に保管先を確認します。' },
  { text: 'コミット版Aから未コミット版Bへ編集してhard resetしました。reflogで元コミットを救出すると？', choices: ['必ず最新版Bが戻る', '未追跡ファイルもすべて戻る', '記録済みのAは戻せても、未記録のBは保証されない'], answer: 2, reason: '参照移動の記録と、作業ファイルの編集履歴は別です。保存済みのコミットの内容を復旧し、保存していない最新版まで復旧できたとは扱いません。' },
  { text: 'このアプリでcheckpoint保存後に編集し、保存せず再読込しました。再開されるのは？', choices: ['最後に保存ボタンを押した時点', '保存後の全キー入力', 'PC内の実リポジトリ全体'], answer: 0, reason: '明示checkpointは保存時点の模擬状態だけを持ちます。保存後の入力やPC内の実Gitは含みません。' },
];
