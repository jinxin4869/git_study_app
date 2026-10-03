# PR #6マージ後の再評価と修正（2026-10-03 JST）

個人がブラウザ上でGitを学ぶ用途に対し、保存履歴を守ること、状態に基づく採点、失敗入力の拒否、実行できる復旧案内を優先した。139演習と既存の暗色3パネル・主要操作を維持する。全98 IDとIDのない候補の判断は [ロードマップの末尾の最新節](remaining_work_roadmap.md#マージ後の再評価基点-cd3272dpr-6取込後) に記録した。調査履歴は削除しない。

## 基点・他の作業の保護・公開版

fetch後の `origin/main` と作業開始時のHEADは `cd3272dbff8f8be486b2acf4fb56cf34b3b45d14`。本体worktree 1件、stashなし、開始時の作業ツリーclean。既存のローカル・リモートブランチを保持して `fix/post-merge-learning-reliability` を新設した。作業中の再fetchでもorigin/mainは同SHAだった。ローカルmainも `git fetch origin main:main` でa94b380から同SHAへfast-forwardした。破棄/stash/強制pushは行っていない。

[PR #6](https://github.com/jinxin4869/git_study_app/pull/6)は2026-10-03 07:26:09 UTCにマージ済み。mainの [CI 37106344391](https://github.com/jinxin4869/git_study_app/actions/runs/37106344391) と [37106344588](https://github.com/jinxin4869/git_study_app/actions/runs/37106344588) は同SHAで成功。Production deployment `6824782584` は07:27:03 UTC、同SHAでsuccess。deployment URLは [git-study-ri9niabwb](https://git-study-ri9niabwb-jinxin1024s-projects.vercel.app)、画面の確認先は [公開alias](https://git-study-app.vercel.app)。固有URLの保護された画面の確認と公開aliasの検証は区別する。

公開aliasに対して12件（6フロー×PC/390px幅、再試行0）が成功。ホームからヒントなし達成、再読込/リセット/記録削除、複数タブ、rebase中断/プレビュー復帰、端末の追従停止/再開、前提/達成説明/次のおすすめを確認した。新しいテスト用ブラウザ内のlocalStorageだけを変更し、実GitHub・学習ログ収集・deployは行っていない。この修正ブランチの変更は**まだ公開版に含まれない**。所有者のマージ後に新deployment/SHAで再検証する。

## 修正前の再現と結果

基点のユニット565件は成功していたが、次の不足経路を再現できた。新しい単体テストの最初の5件は修正前にすべて失敗し、保存読取と偽競合の2件のUIテストも旧ビルドで失敗した。結果件数は当該経路の証拠であり、全Git操作の保証ではない。

| 再現手順 | 基点での問題 | 修正後 |
| --- | --- | --- |
| Level 1-9で `echo changed > README.md` → `git reset --hard HEAD README.md` | 未対応パス引数を無視し、成功として作業内容を破棄 | 操作前に拒否、GitStateを保持。対応するstage解除はrestoreを案内 |
| 変更をstash → `git stash drop missing-reference` | 不明参照を無視して最新stashを削除 | 不明参照を拒否、stashを保持 |
| Level 7-1で `git merge feature missing-reference` | 余分な対象を無視し競合生成、失敗結果でも競合発生課題に合格 | 引数数を変更前に検証し、無変更・未達 |
| 同課題で `echo "<<<<<<< HEAD" > index.html` | 文章中の文字だけで競合扱い・合格 | 実際の未解消パスがないため未達。通常のプレビューを開ける |
| 自由練習でマーカー例の文章を作成 → add → commit | 通常ファイルを競合扱いしcommitを拒否 | 通常文書としてstage/commit可能 |
| 完了後、Storage.getItemがSecurityError → storage通知/保存再試行 | 読めない記録を「存在しない」と扱い既知の完了表示が消える | 読取拒否のIDだけ既知表示を保持。復旧後の実削除は反映 |
| 完了/ヒントの削除で後のremoveItemだけ失敗 | 途中まで削除し、成功前の画面と保存内容が食い違う | 削除前に対象を読取。失敗時に可能な範囲で戻して再削除を案内。警告へフォーカスして小画面でも表示 |
| stash競合→ `echo "Combined" > app.ts` | 編集だけで課題を達成でき、stageの必要性が不明確 | 未解消パスが残る間は未達。`git add app.ts`後に全条件達成 |

追加の引数境界はreset/stash/merge/replayだけでなく、clone/branch/checkout/remote/push/fetch/pull/config/tag/blame/mv/worktree/bisect/sparse/submodule/LFSと模擬PRを点検した。各コマンドが現在再現できる引数数・対象を検証し、未対応構文を黙って一部実行しない。PR番号の小数/指数/16進表記と追加対象は拒否する。全Git引数の共通文法・help一元化の完成ではない。

`stash -m "-u"`は説明文字列として扱い、未追跡ファイルの退避を勝手に有効化しない。`git add -- -p`はファイル名を扱い、`git add -A app.ts`は指定対象だけをstageする。模擬PRのtitle/bodyの値もflagと取り違えない。既存の引用符、空白/特殊名、シェル連結拒否を維持する。入力から外部プロセスは実行しない。

## 競合と採点の契約

`GitState.unmergedPaths`に実際の未解消パスを持つ。merge、stash、rebase/cherry-pick/revertで競合した時に設定し、内容の編集だけでは消さない。git addでマーカーを除いた解消内容（または削除）をstageすると該当パスを除く。未解消中はcommit/続行/別操作開始を拒否する。abort/skip/resetで状態を適切に戻し、無関係な未追跡ファイル保持の回帰を維持する。

fileStates、status、競合解決セッション、操作案内と採点でこの状態を共有する。通常のマーカー例は競合表示/三択にしない。未解消で内容を編集済みなら通常プレビューで内容を確認でき、stageが必要だと案内する。statusは `Unmerged paths` と `unmerged: <パス>` を表示する。実Gitのboth modified/deleted by us等の細かい分類は再現していない。

`conflict_present`は実際の未解消パスを要求する。`state_matches.unmergedPaths: []`は解消してstage済みを条件にし、同じassessmentのラベルを未達理由に使う。stash課題は説明・ヒント・goal・solution・注意・[教材レビュー](lesson_review.md)を同時更新した。保存済みの過去の完了記録は消さず、新しい挑戦には現在の採点を使う。

merge/replayは既存の続行・中断候補を維持する。stashにはgit statusと内容解消→stage、演習リセットの案内を表示する。存在しない `git stash --abort` や未対応 `git merge --continue` は案内しない。[Git公式のstash](https://git-scm.com/docs/git-stash)、[merge](https://git-scm.com/docs/git-merge)、[reset](https://git-scm.com/docs/git-reset)と対応範囲を比較した。

モデルはファイル単位の模擬であり、実indexのstage 1/2/3、行単位の自動統合、全競合モードは未再現。既存の競合解消課題のacceptedContents/マーカー検査は弱めない。任意の別解・操作組合せの保証には追加モデル/テストが必要。

## 保存例外と互換性

version 1、selection/complete/hintのキーとJSON形式を維持する。新しいunreadableCompletionsは読込結果のメモリ情報であり、保存しない。GitStateや端末履歴も保存しない。getItem例外の既知完了だけ保持し、壊れたJSON、無効型/ID、検証できた削除を保持したことにしない。初回起動で読めない未知の記録を復元できたとも扱わない。

削除時は対象キーをすべて読んでから消す。途中で失敗した時、既に消したキーだけを、まだ存在しなければ戻す。別タブの新しい値を上書きしない。rollbackの書込も失敗したら一部を戻せない可能性を通知する。保存再試行と削除の再実行は別。複数キーの強い原子性や同一IDの同時操作を完全には保証しない。同一IDの完了/削除はlast-write-wins、異なる演習の完了は独立キーで保持する。

`cd3272d`の旧ProgressStoreと現在を別々にコンパイルして同一メモリ保存領域で比較した。旧→新、新→旧のselection/complete/hint、双方での削除の結果は一致し、warningsなし。変更されたヒント/採点は既存履歴の一括削除を伴わない。

## 検証結果

環境はUbuntu 22.04、Node 22.22.1 / npm 10.9.4、実Git 2.34.1、Next 15.5.27。監査CLIのみnpm 11.21.0を使用。基点565件/42フローを維持する。

| 検査 | 結果 / 範囲 |
| --- | --- |
| lint / typecheck / 本番build | 成功。既存Hooks/a11y検査を維持。/game First Load JS 216kB |
| unit | 616件 / 25ファイル成功。追加のエンジン45件と保存6件、既存139演習の解答/実Git比較/特殊名/状態保持を維持 |
| localhost E2E | 最終276件成功（46フロー×Chromium4サイズ/Firefox/WebKit）、workers2・retries0。新しい保存読取/削除障害/偽競合/stash stageの4フローを含む |
| 自動アクセシビリティ / 画面確認 | 既存axe5状態×6構成で指摘0、キーボード/合成IMEを維持。PC/390px幅の保存失敗・stash案内を一括確認し、小画面の削除警告を表示する修正後に再確認 |
| 公開smoke | PR #6マージ後の公開aliasで12件成功、PC/390px幅、再試行0。今回修正の公開検証ではない |
| 保存双方向互換性 | cd3272dとの旧→新/新→旧/双方削除が一致 |
| 依存監査 | npm11で本番0・終了0、全High5・終了1。未解決警告とnpm10 endpoint失敗は[依存記録](dependency_security_updates.md) |
| PR CI / Preview | 最終対象SHAとchecksは作業PRに記録。標準Ubuntu24.04/Node22/OS依存付き3ブラウザを維持 |

```bash
npm run lint
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e -- --workers=2 --retries=0
npm run test:e2e:production
```

ローカルWebKitはPR #5/#6と同じ公式WebKit 2359＋一時OSライブラリ/ランチャー。Chromium4サイズとFirefoxは標準設定。ローカルの一時Playwright設定はコミットしない。CIは `npx playwright install --with-deps chromium firefox webkit`。テストskip/検査無効化はなし。

初回の修正後E2Eは270成功/6失敗。偽マーカーのクリックでプレビューが開かなかった。画面側だけが旧マーカー判別を残していたため、engine.openConflictResolutionが返す実セッションで振り分けるよう修正し、全構成を再実行した。テストの期待を弱めず、修正後に276件成功。その後のPC/390px幅の画面確認で、削除失敗の警告が小画面サイドバーのスクロール外に隠れる問題を見つけた。明示的な削除失敗では警告へフォーカスするよう修正し、警告がサイドバー表示範囲内にあることもE2Eで検証した。通常の端末出力やstorage通知のたびにフォーカスを移動する変更ではない。この最終変更後も276件成功（2.9分、再試行0）。390px幅で警告・削除確認・再試行を読めることを画像で再確認した。

## 未検証と後回しの具体的な範囲

実機IME、ソフトキーボード、スクリーンリーダー、実Safari、ブラウザの200%ページズームはこのLinux環境からアクセスできず未検証。合成IME、WebKit、自動axe、文字サイズ200%はこれらの代用ではない。担当端末でOS/ブラウザ/入力方式/通知順序とフォーカスを記録する。A02/A09とA01/A04/A05/T07/T08の残る範囲に記載した。

途中Git状態の完全復元/export-import/詳細比較/自由編集/追加実務演習/大規模分割/未実測の性能最適化は、現状の139件の独立演習・ブラウザ記録・状態説明に必要な前提と具体的な需要が不足している。再検討条件をID別に残す。E03は通常マーカーの誤合格が再現したため、未解消パスの部分を今回へ戻した。

アカウント/クラウド同期/講師管理/実GitHub接続/外部AI/外部ログ/PWA/教材管理画面/利用目的未定の多言語は現在用途では見送り。永久に不要とはせず、利用者・目的・運用条件が決まった時に再検討する。

bracesの修正版とESLint 10 plugin peer対応は未解決。既存Dependabot #7（互換）と#8〜11（major）の採用レビューは別作業。公開rollbackは障害がなく実施していない。今回PRの公開本番検証は所有者のマージ後に残る。これらを今回のコード修正完了と混同しない。
