# 依存更新後の公開確認（2026-10-04 JST）

現在の確認対象は `origin/main` の `4c119178b2f1df4fffc4382edf409c9abe12e2bb`。PR #12の保存・競合修正と依存更新PR #7〜11はすべてマージ済み。以前の「未公開」「依存PRを別途レビュー」は当時の記録であり、現在の状態は本書と[ロードマップ末尾](remaining_work_roadmap.md#依存更新後の現行状況2026-10-04-jst)を参照する。

## 依頼された4点の状況

| 作業 / 関連ID | 実施範囲 | 残る範囲 |
| --- | --- | --- |
| 最新公開版の確認 / T10・O07 | 最新mainのCI・ProductionのSHAを確認。公開aliasで9フロー×PC/390px幅の18件成功、再試行0 | 今後のリリースでも対象SHAを確認して再実行。実Safari・実端末の保証ではない |
| 記録の現行化 / D01・O04 | README、ロードマップ、公開runbook、依存記録、PR #12再評価記録を更新。旧記録は対象版を付けて保持 | 将来の変更時にも更新 |
| 実機確認 / A02・A09、A01・A03〜A05・T07・T08の関連範囲 | 利用環境を調査し、[実機確認の手順と結果票](manual_device_checks.md)を作成 | **実施未完了**。実IME・ソフトキーボード・読み上げ・Safari・200%ページズームの利用可能な端末と操作手段が必要。自動テスト成功で完了とは扱わない |
| 再監査と継続保守 / O04・F09 | 本番0件、全依存High 5件。修正版とESLint peer対応を再確認。既存の月次Dependabotと手動監査・更新条件を明記 | braces修正版なし、ESLint 10 plugin対応待ち。警告の解消自体は未完了 |

新しい演習やアカウント・外部ログ収集は追加しない。今回の変更は公開版の回帰テストと記録であり、アプリの表示・保存形式・依存バージョンは変更していない。

## main・CI・公開先の対応

| 証拠 | 対象 / 結果 |
| --- | --- |
| 最新main | `4c119178b2f1df4fffc4382edf409c9abe12e2bb`（[PR #10](https://github.com/jinxin4869/git_study_app/pull/10)マージ） |
| main CI | [Tests 37134560373](https://github.com/jinxin4869/git_study_app/actions/runs/37134560373)、同SHAでsuccess |
| Production | GitHub deployment `6829693868`、同SHA。2026-10-03 15:49:31 UTC（10-04 00:49:31 JST）にsuccess |
| deployment固有URL | [git-study-k86taod8c](https://git-study-k86taod8c-jinxin1024s-projects.vercel.app)。保護画面の操作確認済みとは扱わない |
| 操作確認先 | [公開alias](https://git-study-app.vercel.app)、2026-10-04 13:59 UTC以降にHTTP 200と画面操作を確認 |

開始時の本体worktreeはclean、stashなし。既存ブランチを保持し、最新origin/mainから別worktreeの `chore/post-release-verification` で作業した。mainへの直接push・PRのマージ・手動deployは行わない。

## 公開版の検証

`npm run test:e2e:production` は18件成功（51.6秒、workers 2、retries 0）。新規ブラウザプロファイルのlocalStorageだけを変更する。公開先へのdeployや実GitHub操作は行わない。PCは1440×1000、390px幅は390×844のChromium自動ブラウザであり、実スマートフォンではない。

従来の6フローを維持し、最新PR #12の修正を確認する3フローを追加した。

1. ホームから演習へ移動し、ヒントを開かずに達成する。
2. 完了・選択を再読込で復元し、途中Gitは初期化する。失敗入力は未達、Gitリセットは完了記録を保持、現在演習の記録削除は別演習を保持する。
3. 2タブで別演習の完了記録を失わない。
4. rebaseの中断候補を実行して達成し、プレビューをEscapeで閉じると起点へフォーカスが戻る。
5. 過去の端末出力を読んでいる間は追従を止め、ボタンで最新へ戻る。
6. ヒントなしで前提・達成解説・次の演習が利用できる。
7. Storage.getItemのSecurityErrorをテストページ内で注入し、保存警告と既知完了の保持を確認。読取を回復して再試行すると警告が消え、完了を保持する。
8. `git merge feature missing-reference` と通常ファイルの `<<<<<<< HEAD` は競合課題を達成しない。リセット後の実際のmerge競合は全条件を満たす。
9. stash競合は内容を編集しただけでは未達・未保存。statusに未解消パスがあり、正しい内容をstage後に全条件・合格表示が一致する。元のstashは残り、存在しないstash中断コマンドを表示しない。

## ローカル・PRでの検証

Ubuntu 22.04、Node 22.22.1 / npm 10.9.4。監査CLIだけnpm 11.21.0を使った。`npm ci --no-audit` は成功し、明示的な監査は別に実行した。

| 検査 | 結果 |
| --- | --- |
| lint / typecheck | 成功 |
| unit | 621件 / 25ファイル成功。実Git比較・特殊名・状態保持・139演習の解答を維持 |
| 本番build | 成功。/game First Load JS 217kB |
| 公開smoke | 18件成功、再試行0。上記の対象mainに対する結果 |
| localhost E2E | 230件成功（46フロー×Chromium4サイズ/Firefox、workers 2、retries 0）。保存・採点・操作復旧・axe等の既存回帰を維持 |
| PR CI | [Tests 37208621437](https://github.com/jinxin4869/git_study_app/actions/runs/37208621437)、PR #13のSHA `c75cc24` で成功。lint/type/unit621/build、全6構成E2E276件成功、再試行・flakyなし。標準Ubuntu 24.04環境を使用 |
| 依存監査 | 本番0件・終了0、全依存High 5件・終了1。APIエラーなし |
| package/lockfile | `git diff --exit-code origin/main -- package.json package-lock.json`で変更なし |

Linuxの表示環境はあるが、実Safari、日本語IME・読み上げソフト、端末接続ツール・USBアクセス、画面を操作するツールがない。利用可能な担当端末を利用者へ確認したが、実機結果はまだ得られていない。詳細な手順と結果票を用意し、未検証範囲をA02/A09等に残した。

ローカルUbuntu 22.04にはWebKit 2359のキャッシュがあるが、従来使用した一時OS依存/ランチャーがない。ローカルで実行可能なChromium/Firefoxを確認し、WebKitは既存CIのUbuntu 24.04と `playwright install --with-deps` の標準環境で検証する。テストをskipしたりCI検査を無効化したりしない。

変更は[PR #13](https://github.com/jinxin4869/git_study_app/pull/13)。上記CI成功後の追記は記録と実機手順のみで、検証対象のテスト/アプリ/依存は変更していない。最新HEADのchecksは[PR checks](https://github.com/jinxin4869/git_study_app/pull/13/checks)も参照する。コミットとpushは作業ブランチへ行い、mainへのマージ・手動公開は行わない。

## 継続する条件

通常の月次保守と依存更新時に、[依存記録の最新節](dependency_security_updates.md#依存更新pr取込後の再監査2026-10-04-jst)の2種類の監査・peer確認を実行する。次回の月次確認目安は2026-11（Dependabotは既存設定で通知）。新しい本番脆弱性または現用途の不具合が再現した場合は、月次を待たず対象版と再現手順を記録して修正する。

braces修正版または親依存の修正経路、ESLint 10への必要なpluginのpeer対応が公開されたら別PRで更新し、lint・型・unit・build・6構成E2Eを通す。件数だけを減らすダウングレードや検査無効化は採用しない。
