# シミュレーターの信頼性修正（2026-10-03）

ブランチ: `fix/simulator-reliability`。残作業ロードマップのF01〜F04を対象とする。

## 修正した挙動

- **F01**: 競合画面を開いたときの状態の版を保持し、適用直前にエンジンで照合する。状態の変更・演習の再読込・中断・skip後の解決結果は適用できない。状態が変わった場合は画面も閉じる。`status`などの状態を変えないコマンドや拒否されたコマンドでは選択を保持する。
- **F02**: `conflict_resolved`には課題ごとの`acceptedContents`が必要。Level 7-3ではHTML全体を残し、World側・Git側・両見出しを残した完成内容を受け入れる。競合を見出し部分に限定し、Accept BothでもHTML文書全体を重複させない。空ファイル・見出しだけ・無関係な内容・残ったマーカーは不合格。空の解決を意図する課題では空文字列を明示的に定義する。
- **F03**: `status`と`commit`は未対応・不明な引数を拒否し、対応する構文を案内する。失敗時はHEAD・index・ファイル・reflogを保持する。`-m`の値はオプションとして解釈せず、複数の`-m`は段落として連結する。
- **F04**: `git rm`は通常、indexとHEADと作業ファイルが一致する場合に削除できる。`--cached`ではindexがHEADまたは作業ファイルと一致することを要求する。既に作業ファイルがない場合と`-f`／`--force`による強制削除も実Gitの挙動に合わせる。

## この修正で対応する引数

| コマンド | 対応範囲 |
| --- | --- |
| `git status` | 引数なし、`--ignored` |
| `git commit` | `-m <message>`（複数可）、`--amend`、`--amend --no-edit` |
| `git rm` | 一つのファイル、`--cached`、`-f`／`--force`、`--`区切り |

例えば`status -s`、`commit -a`、複数ファイルやディレクトリに対する`rm`は案内付きで拒否する。Gitにあるすべての引数・pathspecを模擬するものではない。

## 検証

最終コードでユニットテスト295件、4画面サイズのE2E 52件、lint、型チェック、本番ビルドが成功した。

- 回帰テストで、空の競合解消、不正な引数、古い解決結果の適用と失敗後の状態保持を確認する。
- 一時リポジトリの実Gitと、11種類のHEAD／index／作業ファイルの状態×4種類の削除フラグを比較する。既存の作業リポジトリに比較用の削除操作を実行しない。
- Chromiumのdesktop・mobile・narrow・tabletで、中断後の画面、再度の競合、空の解決の拒否、三つの解決選択肢、不正なコマンドによる達成の防止を検証する。
- `npm test`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm run test:e2e -- --workers=2`で検証する。

削除条件は[Git公式のgit-rm](https://git-scm.com/docs/git-rm)、引数は[git-status](https://git-scm.com/docs/git-status)と[git-commit](https://git-scm.com/docs/git-commit)も参照した。F05〜F09、継続学習の拡張、Firefox・WebKit・実機IME・本番公開後の確認は今回の対象外。
