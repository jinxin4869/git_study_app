# 一括改善のコードレビュー（2026-10-25）

`code-review`スキルの一般レビューモードで、現在の未コミット差分（既存変更と新規ファイル）を確認した。対象基点は作業開始時のmain `1a9533c`。今回の依頼はレビューと修正、コミット・push・PR作成まで。実画面確認は利用者の前の指示を引き継いで対象外とする。

## 再現・修正した指摘

| severity | location | 問題・影響 | 修正 |
| --- | --- | --- | --- |
| medium | `src/learning/session-store.ts:parseJson`、`src/components/learning-transfer.tsx` | 保存・exportは文字数、ファイル取込はバイト数で5MBを判定していた。日本語を多く含むと、書き出せても取り込めないファイルになる | UTF-8のバイト数で判定し、容量定数を共用。日本語1文字3バイトで上限を超えるケースを拒否し、保存前に検証する回帰を追加 |
| medium | `scripts/real-git-lab.mjs:CLI entry point` | `URL.pathname`は空白/日本語がエンコードされ、Windowsではドライブ表現も異なる。エントリポイント判定がfalseになり、CLIが何もせず成功終了する。macOSの一時フォルダのsymlinkでも不一致になる | `fileURLToPath`と`realpathSync`で同じ実ファイルとして比較。日本語・空白を含むディレクトリから子プロセスでsetupを実行する回帰を追加 |
| medium | `src/app/game/page.tsx:onBack` | 戻る/進むで表示演習だけ切り替え、最後の選択を保存していなかった。ホームから再訪すると、戻る前の演習が復元される | 履歴移動時に実際の演習選択と解除した絞り込みを保存し、失敗時には警告。戻る→ホーム→学習開始の回帰を追加 |
| medium | `src/app/game/page.tsx:refreshImportedProgress` | 取り込み後のsnapshotをそのまま完了一覧へ入れると、一時的に読み取れない既知完了が消える。また初期localStorage拒否時にstoreRefがnullのままだと、復旧後の取り込み成功を表示へ反映できない | 取り込み後にstoreを再作成可能にし、既存のcompletedFromSnapshotで既知完了と未保存完了を保持。未保存ヒントの最大値も保持。部分的読取拒否と初回拒否からの復旧をE2Eへ追加 |

4項目とも、修正前に失敗する回帰で確認した。修正後は対象テストが成功することを確認した。E2Eの警告検査は、Next.jsのroute announcerと混同しないようアプリのmain内に限定する。

## レビュー範囲

- 保存・取り込み: 既存version 1との互換、未知形式・過大入力・不正参照・循環・部分失敗・別タブ更新・読取失敗時の保持
- Git操作: merge/rebase/cherry-pick/stash/模擬PRで行単位統合を共有し、既存の内容保持・未解消パス・採点を維持すること
- 学習UI: 3領域比較、remote/tag/upstreamの位置とahead/behind、競合編集のrevision検証、履歴移動・保存、入力・キーボード操作
- helpと教材: help参照のみで合格させないこと、対応範囲の説明と実Gitへの移行教材
- 運用: dependency lock、監査workflow、CIのテスト経路、READMEと過去記録の区別

## 最終検証

- Vitest: **642件成功**（27ファイル）。実Gitラボ: **7件成功**。
- E2E: **348件成功・再試行0**。macOSのChromium4サイズ＋WebKit290件、公式LinuxコンテナのFirefox58件。
- lint・typecheck・本番build・git diff --check成功。Linuxコピーでもlint/type/unit/lab/buildが成功。
- npm audit: **全依存0件・本番0件**。
- 以前の330件成功の記録は前回実装時点の結果であり、今回の追加3フローを含む348件の結果とは区別する。
- 画面・実機・本番smokeは今回未実施。mainへのマージ・本番deployは行わない。PRのCI結果はGitHub側で別途確認する。

- Blocking issues: 4件を修正。未修正のblocking issueはなし。
- Non-blocking issues: 新たに報告する高確度の指摘なし。
- Overall summary: 局所的な4不具合を修正し、既存の機能範囲を保つ。画面・実機確認は成功扱いにせず、今回も対象外とする。
