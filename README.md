# Git Learning App (Antigravityによる初期実装)

インタラクティブにGitを学習できるWebアプリケーションです。ブラウザ上で動作するGitシミュレーター、コミットグラフの可視化、そして実践的なシナリオを通じて、Gitの基本から応用までを学ぶことができます。

## 特徴

-   **ブラウザ内Gitシミュレーション**: サーバーサイドのGitに依存せず、ブラウザ上でコマンドを実行・学習できます。
-   **視覚的なフィードバック**: コミットグラフやファイルツリーがリアルタイムに更新され、操作の結果を直感的に理解できます。
-   **実践的なシナリオ**: 基本的なコミットから、ブランチ操作、マージ、コンフリクト解消まで、段階的に学べるレベルを用意しています。
-   **コンフリクト解消UI**: 実際の開発現場のようなGUIでのコンフリクト解消を体験できます。
-   **実務向けの小さな演習**: ステージ解除、変更の取り消し、削除・名前変更、amend、目的別コミットを個別に練習できます。
-   **GitHubの模擬演習**: PR作成、レビューの修正依頼、CI失敗への対応、修正後の再チェックとマージを練習できます。実際のGitHubには接続しません。

## 学習内容と対応状況

現在は139演習です。`/game` で演習を選び、ターミナルにコマンドを入力します。各演習の初期状態は独立しています。コースとコマンド名で絞り込みでき、やり直しボタンで選択中の演習を最初から試せます。

| コース | 演習数 | 内容 |
| --- | ---: | --- |
| 基本操作 | 10 | init、ファイル作成、status、add、commit、log、diff |
| ブランチ | 12 | ブランチ作成、切り替え、並行開発、履歴の分岐、名前変更、削除、Detached HEADの救出 |
| マージ | 6 | 統合先の確認、fast-forward、マージコミット、--no-ff |
| 作業の退避 | 11 | stash、一覧、復元、未追跡ファイルの退避、複数の保存、削除、復元時の競合 |
| 取り消し | 4 | soft／hard reset、修正して再コミット |
| 過去の調査 | 3 | 履歴、Detached HEAD、ブランチへの復帰 |
| コンフリクト | 4 | 発生、確認、解消、マージの完了 |
| 日常操作・取り消し | 18 | ステージ前後の差分、ファイルごとの記録、restore、rm、mv、amend、switch、目的別コミット、add -p、.gitignore、追跡解除 |
| GitHub・PR・レビュー・CI | 9 | PR作成・確認、修正依頼、CI失敗・成功、承認、マージ、PRを閉じる、レビュー修正 |
| リモート・チーム開発 | 13 | clone、接続先の管理、fetch、pull、push、upstream、分岐後の統合、pull --rebase、prune、force-with-leaseの拒否 |
| 履歴・調査・復旧 | 16 | log、show、rebase、cherry-pick、revert、reflogでの救出、タグと保守ブランチ、blame、履歴検索、タグのpush |
| 競合の継続・中断 | 6 | rebase／cherry-pick／revertの競合解消・--continue・--abort |
| 履歴整理・対話的rebase | 6 | reword、squash、fixup、drop、並び替え、editによるコミット分割 |
| 不具合の調査 | 4 | bisectの開始、good／bad、原因コミット特定、reset |
| 並行作業・特殊構成 | 10 | worktree、sparse-checkout、submodule、Git LFSの対象設定 |
| 実務の総合演習 | 7 | 機能開発からPR、チームの競合、緊急修正、履歴整理、復旧、revert、リリース保守 |

GitHub演習では、`gh pr create/view/checks/merge/close` に加え、アプリ専用の `simulate` コマンドで模擬レビュアーとCIを操作します。

```text
gh pr create --title "Add login" --body "ログイン機能とテストを追加" --base main
simulate review approve 1
simulate ci pass 1
gh pr merge 1 --merge
```

承認やCIの結果はコミットに紐づきます。新しい変更をpushすると、以前の承認やCI成功ではマージできません。模擬CIは指定した成功・失敗を再現するもので、実際のテストやGitHub Actionsは実行しません。

### 学び方と再現範囲

[実務向けGit学習カリキュラム](docs/practical_git_curriculum.md)に、細かい操作を12章に整理しています。一操作ずつ練習したあと、7つの総合演習で実務の流れを通して試せます。検索は説明・ヒント内のコマンドも対象です。クリアした演習の完了記録はこのブラウザに保存されます。

対話的rebaseは画面の編集欄でtodoを変更し、`git rebase --continue` で進めます。`git add -p` は提示された変更に `y`／`n`／`q` で応答します。

シミュレーターはGitの全コマンド・全オプションを再現していません。テキストの離れた行の変更は自動統合し、同一・隣接範囲の変更や削除対変更は競合として扱います。rename検出や全merge戦略には対応していません。bisectは主に第一親の直線履歴、sparse-checkoutは基本的なcone形式を扱います。worktreeの移動やsubmoduleは仮想のファイル状態で再現します。Git LFSは `install`／`track` と `.gitattributes` の設定を練習する範囲で、バイナリのポインタ変換・転送は行いません。実Gitとの差とLFSポインタの読み方はカリキュラムに記載しています。

全139演習に、課題ごとの考え方・確認方法・実務上の注意と解答手順があります。初期状態から達成までの自動テストを用意しています。「この演習の前提」と完了後の「次のおすすめ」は学ぶ順の案内で、先の演習も自由に選べます。

### 続けて学ぶ・困ったとき

- 完了日時・ヒント利用・最後の演習・コースと検索を、このブラウザのlocalStorageに保存します。再読み込み後に演習選択と完了一覧を復元します。**通常の再読み込みは演習の初期状態から再開します。** 「途中状態・バックアップ」で明示保存したGit・端末履歴は、再開ボタンで復元できます。 同じブラウザでも、別のオリジン・プロファイル・端末には共有されません。
- 「基本操作から始める」と「自由練習に切り替える」で入口を選べます。切り替えると現在のGitの途中状態は破棄され、完了記録は残ります。
- ヒントは最初は閉じています。必要なときに「考え方→確認方法→コマンド→解答例」の順で開きます。開かずに演習を進められます。
- 達成条件と未達の条件を共通の採点基準で表示します。状態を学ぶ課題は内容・参照・履歴等も検証し、失敗したコマンドでは合格しません（競合発生を学ぶ課題の意図した停止は別扱いです）。
- 端末出力は端末内で追従します。過去ログを読む間は停止し、「最新の出力へ戻る」で再開します。動きを減らす設定も反映します。
- 達成後は、その時点で満たした条件と理由・注意を表示します。過去の完了記録は当時の履歴として保持し、再挑戦は現在の基準で採点します。
- 保存領域を一時的に読み取れないときは、この画面で分かっている完了表示を保持します。保存の許可を確認して再試行してください。記録削除の途中で失敗した場合は可能な範囲で元へ戻し、再削除を案内します。戻す処理も失敗した場合は、一部が削除済みの可能性を通知します。
- 競合は実際の未解消パスで表示します。通常の文章に競合マーカーを書いても競合演習は達成になりません。実競合は内容を編集してから `git add` で解消を記録し、操作案内に沿って続行します。stashの競合には専用のabortはなく、元のstashを残します。
- merge・rebase・cherry-pick・revert・bisect・部分ステージング中は、現在の状態と続行・中断方法を表示します。入力候補を選んだあと、内容を確認してEnterで実行します。
- 「保存と再開」で、この演習またはすべての保存記録を削除できます。「現在の演習を最初からやり直す」はGitをリセットし、保存記録は残します。
- 保存の破損・未対応バージョン・容量/許可エラーを通知します。「保存を再試行」で未保存記録を再試行できます。未対応バージョンは勝手に上書きせず、必要なら記録を削除して復旧します。保存できないままページを閉じると、未保存の記録は失われます。
- 別タブの完了・削除は一覧に反映します。演習ごとに記録を保存するため、別演習を同時に完了しても一方の完了を上書きしません。同じ演習の完了と削除が同時の場合は最後の操作が残ります。

### 比較・復習・持ち出し

- ファイルプレビューで「HEAD・ステージ・作業ツリーを比較」を開くと、3領域の内容と差分を確認できます。
- グラフはremote追跡参照・タグと、設定済みupstreamに対するahead/behindを表示します。remoteはfetchした時点の参照です。
- 競合解消の三択は結果をプレビューでき、必要な行を直接編集して適用できます。内容を確認してからgit addで解消を記録します。
- 難易度・完了状態で絞り込めます。「ヒント利用記録なし」は過去のヒント記録がない演習です。所要時間は未計測の目安です。追加した2つの絞り込みは画面内だけで保持します。
- `/game?lesson=level-1-3`のような演習URLで初期状態を共有できます。ブラウザの戻る・進むでも演習を切り替えます。
- 「途中状態・バックアップ」で保存・再開、JSON書き出し・取り込みができます。rebase・競合・部分ステージング中も保存できます。未適用の競合編集は適用後に保存してください。バックアップは保存済み記録のみで、コマンドやファイル内容も含まれます。5MB以下・形式/ID/参照等を検証し、取り込み前に上書き範囲を表示します。
- 「操作リファレンス・理解度チェック」には用語比較と6問の確認問題があります。端末では `git help`、`git help restore`、`git restore --help` が使えます。helpを開くだけでは演習を達成しません。
- `/real-git`に、自分のPCで実行する4つの実Git演習があります。`npm run lab -- setup staging`等でOS一時フォルダに専用リポジトリを作り、`npm run lab -- verify <パス>`で結果を検証します。実GitHub接続は不要です。

今回の対応・互換性・検証結果は[一括改善記録](docs/batch_improvements.md)を参照してください。

実装・保存形式・検証範囲は [学習体験改善の記録](docs/learning_experience.md)、今回の教材・入力・操作性は [改善記録](docs/learning_refinements.md)、全候補の分類は [残作業ロードマップ](docs/remaining_work_roadmap.md) を参照してください。

マージ後に確認した公開版、保存・競合・引数検証の追加修正と残る制約は [マージ後の再評価記録](docs/post_merge_review.md) を参照してください。ロードマップは末尾の最新節を使用し、以前の分類は調査履歴として残しています。

依存更新PR #7〜11と修正PR #12はmainへ取込済みです。2026-10-04の公開版確認・再監査は [最新の公開確認記録](docs/post_release_verification.md)、未完了の実機IME・読み上げ・Safari等は [実機確認の手順と結果票](docs/manual_device_checks.md) を参照してください。

## 動作環境

-   Node.js 22.12以上の22系、24系、または26以上（Vitest 5のテストを含む）。CIと同じ22系の最新パッチを推奨します。
-   npm, yarn, pnpm, または bun

依存関係の更新履歴と監査結果は[依存関係のセキュリティ更新](docs/dependency_security_updates.md)を参照してください。

## セットアップ手順

プロジェクトをローカル環境で実行するための手順です。

### 1. リポジトリのクローン

```bash
git clone https://github.com/jinxin4869/git_study_app.git
cd git_study_app
```

### 2. 依存関係のインストール

```bash
npm ci
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## テストの実行

Vitestのユニットテストと、実GitラボのNode.jsテストを実行できます。Gitコマンドが必要です。

```bash
# テストを一度だけ実行
npm run test

# ウォッチモードで実行（開発中）
npm run test:watch
```

### ユニットテストのカバレッジ

```bash
npm run test:coverage
```

V8で計測し、端末の一覧・`coverage/index.html`・`coverage/coverage-summary.json`を出力します。未実行の画面コードも含めて`src/`を集計し、テスト本体・型定義・テスト用シミュレータは除きます。実GitラボのNode.jsテストとブラウザE2Eはこの数値に含まれません。画面コードの低い数値は、E2E未実施や機能不良を直接示すものではありません。

計測は任意で、通常の`npm test`とCIの合格条件は変えません。詳細と読み方は[カバレッジ測定](docs/unit_coverage.md)を参照してください。

### ブラウザのE2Eテスト

Playwrightで画面操作を確認します。初回はChromium・Firefox・WebKitとOSライブラリをインストールしてください。
本番ビルドを用意すると、テストがポート3111でサーバーを自動起動・終了します。

```bash
npx playwright install --with-deps chromium firefox webkit
npm run build
npm run test:e2e

# ブラウザを表示して確認する場合
npm run test:e2e:headed

# 実行結果を表示
npm run test:e2e:report
```

ChromiumのPC・スマホ・狭いスマホ・タブレットの4サイズと、FirefoxのPC・WebKitのスマホサイズで、検索・やり直し、競合解決、対話的rebase、部分ステージ、模擬PRの承認・CIを確認します。保存・再開・破損・削除・複数タブ、段階ヒント、合成IMEイベント、通知とフォーカスも確認します。実機IME・実スクリーンリーダー・実Safariは別途確認が必要です。フッターの重なり、HEADラベル、過去ログの追従停止とページ位置の保持、動きを減らす設定、文字サイズ200%・横向き・強制カラーも検証します。axe-coreでホーム、ヒント、達成、競合、保存エラーの5状態を検査します。自動検査だけでアクセシビリティの適合を保証しません。画像と失敗時のトレースは `test-results/`、HTMLレポートは `playwright-report/` に出力します。

GitHub ActionsではmainへのpushとPRごとに、lint・型チェック・ユニットテスト・本番ビルド・E2Eテストを実行します。レポートは14日間保存します。

公開環境の主要経路は `npm run test:e2e:production` で別途確認します。通常E2Eはlocalhost、本番smokeは公開URLを使います。公開と復旧の手順は [公開確認と戻し方](docs/release_runbook.md) を参照してください。

## ドキュメント

詳細な設計や実装内容については、`docs/` ディレクトリ内のドキュメントを参照してください。

-   [今回の改善と検証](docs/learning_refinements.md): スクロール、全教材レビュー、採点・入力・保存の修正と限界
-   [最新の公開確認と再監査](docs/post_release_verification.md): 依存更新後の公開SHA、18件の公開テスト、4点の対応状況
-   [実機確認の手順と結果票](docs/manual_device_checks.md): IME、ソフトキーボード、読み上げ、Safari、ページズームの未検証項目
-   [公開確認と戻し方](docs/release_runbook.md): PR/本番確認、版付き再現情報、保存互換性、rollback
-   [実務向けGit学習カリキュラム](docs/practical_git_curriculum.md): 12章の学習順序、139演習の対応状況、7つの総合演習、再現範囲
-   [画面修正とE2Eテスト](docs/audits/ui_fixes_and_e2e.md): 監査の5項目への対応、28ケースのブラウザテストとCI
-   [レビューと検証の記録](docs/review_verification.md): 修正した不具合、回帰テスト、ブラウザ確認、クラウドでの確認範囲
-   [01_project_setup.md](docs/01_project_setup.md): プロジェクトセットアップ
-   [02_core_features.md](docs/02_core_features.md): コア機能の実装
-   [03_feature_expansion.md](docs/03_feature_expansion.md): 機能拡張
-   [04_content_expansion.md](docs/04_content_expansion.md): コンテンツ拡充
-   [05_cleanup_and_polish.md](docs/05_cleanup_and_polish.md): 仕上げと修正
-   [06_testing.md](docs/06_testing.md): テストの導入

## 技術スタック

-   **Framework**: Next.js 15 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **Animation**: Framer Motion, Canvas Confetti
-   **Testing**: Vitest、Playwright
