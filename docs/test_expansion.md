# 高度な操作と保存境界のテスト拡張（2026-10-25）

T09/E06について、基本操作の固定seed列に加え、worktree・sparse checkout・部分stage・bisect・対話的rebaseのtodo編集を対象へ追加しました。

## 検証する契約

- 4seed×120回の混合操作列。操作順・ID生成・時刻を制御し、失敗時はseedとコマンド列を表示します。11ステップごとにcheckpointを保存・復元し、stateが一致することも検査します。
- worktree間で作業内容とindexを隔離し、dirty worktreeの削除や使用中branchの削除を拒否します。
- sparse範囲外の追跡ファイルを削除としてstageせず、範囲変更やcommit後も内容を保持します。
- 部分stageのy/n/qと保存再開で、HEAD・作業内容・選択済みのindexを保持します。
- bisectの判定と保存再開、reset、調査中に作成したcommit・tag・stash・設定を保持します。
- todoのpick/drop/fixup/squash/reword/editを保存再開し、不正な重複編集を拒否します。
- 全139教材の初期状態と各解答ステップで、参照・親・履歴の非循環・index・高度な操作状態を検査します。検査器自体も8種類の壊したstateを拒否することを確認します。
- 存在しないtag/reflog/worktree、HEADとの不整合、模擬remoteの親欠損・循環・参照切れをcheckpointとバックアップの両方で拒否します。

検査用helperはカバレッジ対象から除き、アプリの率へ混ぜません。全操作順の網羅を保証するものではありません。新しい操作や不具合を追加した場合も、利用者に影響する境界を個別に検証します。

## 見つかった不具合と修正

`bisect reset`が開始時のGitState全体を上書きし、調査中の新commitやstashを失っていました。タグ/reflogだけが新commitを参照したまま残り、参照切れも生じました。resetでは戻り先のHEAD/index/作業ツリーだけを復元し、commit・ref・stash・設定を保持するよう修正しました。元branchが進んだ場合は現在のtipへ戻り、消えた参照や未追跡ファイルの上書きは拒否します。元がdetached HEADの場合も元の位置へ戻ります。

ローカルの実Gitでも、bisect中にcommit・tag・stash・設定を作成してresetし、それぞれが残ることを比較しました。保存データの検証も、ローカルだけでなく模擬remoteの履歴とtag/reflog/worktreeの参照を検証するよう補強しました。

既存保存のversionは1を維持します。新しい必須フィールドを追加せず、参照の壊れたデータを拒否します。参照切れを含む旧データを自動修復するmigrationは実装していません。
