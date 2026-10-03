# 公開確認と戻し方

用途は個人向けブラウザ学習。公開先は [Git Learning App](https://git-study-app.vercel.app)。学習内容・完了記録はブラウザ内にあり、実GitHub・実リポジトリへの接続や学習ログの外部収集は行わない。

## PRから公開まで

1. 最新mainから作業し、PRの目的・見える挙動・テスト・保存互換性・未検証範囲を記録する。
2. `npm ci`、lint、typecheck、unit、本番build、Playwright 6構成を確認する。CIは標準のOS依存付きChromium/Firefox/WebKitを使う。再試行でのみ通った経路はログから確認する。
3. VercelのPR Previewのビルド状態と対象SHAを確認する。SSO等で画面を開けない場合、成功したビルドだけで画面確認済みとはしない。アクセス可能な担当者が主要経路を確認する。
4. レビュー後、所有者がmainへマージする。作業エージェントはmainへ直接push、マージ、手動デプロイをしない。
5. main連携によるProduction deploymentがReadyになったら、対象SHA・URL・日時・CI run URLを記録する。保護されたdeployment固有URLと公開aliasは別に確認する。
6. 公開aliasに対して、次の明示的な本番smokeを実行する。テストは新規ブラウザプロファイルを使い、そのプロファイルのlocalStorageだけを変更する。公開先へデプロイせず、GitHubの実PRも作成しない。

```bash
npm run test:e2e:production
# 認証なしでアクセスできる別の確認先を指定する場合
PRODUCTION_BASE_URL=https://git-study-app.vercel.app npm run test:e2e:production
```

この設定はwebServerを起動せず、通常のCI E2Eから分離する。ホーム→演習→ヒントなし達成、選択/完了の再読込とGitの初期化、リセットと記録削除の区別、複数タブ、失敗入力、rebase中断、プレビューのフォーカス復帰をPC/390px幅で確認する。今後の意図的なUI変更でsmokeも変わる場合、公開済み版に適用できるテストとPR版用テストを区別する。新UIのスクロール・解説・保存例外は通常E2Eで別途検証する。

実機IME、ソフトキーボード、実読み上げ、Safari、ブラウザの200%ページズームは担当者の端末で確認し、OS/ブラウザ/入力方式と結果を記録する。自動WebKit・文字サイズ200%・合成IMEの成功では代用しない。

## 問題発生時

- 記録する情報：公開URL、deployment/SHA、日時、OS/ブラウザ、演習ID、開始状態、実行コマンド、期待結果/実際の結果、保存警告、再現の可否。必要なスクリーンショットだけを添付し、個人情報や実資格情報は記載しない。
- 保存失敗：ブラウザの保存許可/容量を確認し、ページを閉じる前に「保存を再試行」。Gitリセットは保存記録の削除ではない。壊れた記録は範囲を確認してアプリ内の削除操作で復旧する。他サイトの保存を全消去する手順を案内しない。
- Gitの試行をやり直す：「現在の演習を最初からやり直す」。途中Git/端末は保存されず、完了記録は残る。
- 公開版の障害：まず対象deploymentと正常版を特定する。公開権限を持つ所有者がVercelのDeploymentsから正常なProduction deploymentを選び、Instant Rollbackを行う。対象SHA/URLを確認し、戻した後に公開smokeと保存互換性を確認する。

[Vercel公式のInstant Rollback](https://vercel.com/docs/instant-rollback)では、以前のビルドへ公開先を戻す。環境変数やデータの変更を自動で元に戻す手段ではない。プランによる対象deploymentの制約を画面で確認する。今回は障害対応の必要がないため、実際の本番rollbackは実行していない。

継続的なコード修正はmainの履歴を強制書き換えず、修正/必要なrevertを別PRとしてレビューする。ロールバック後の自動公開状態をVercelの画面で確認し、再公開は所有者の判断で行う。

## 保存・教材の互換性

現行PRと基点 `a94b380` は同じversion 1、同じキー、同じselection/complete/hintの型を使う。GitState・端末を新たに保存しない。旧版で保存→新版で読込、新版で保存→旧版で読込のテストを記録する。公開オリジンが違うPreviewには本番のlocalStorageは共有されない。

採点を厳密化しても、過去の完了日時は削除しない。完了記録は当時の達成履歴であり、現在の試行は初期状態から新しい基準で再採点する。記録があることだけで現在の状態を合格にしない。

将来version 2や途中状態を保存する場合、旧データの移行、未知版の上書き拒否、ID変更、容量不足、複数タブ、旧版への戻し方を実装・テストしてから公開する。旧版が読めない新形式を同じキーへ上書きする更新は行わない。

## 継続保守

Dependabotはnpm/GitHub Actionsの更新を月次で通知する。npmのminor/patchをまとめ、majorは互換性を別にレビューする。PRごとに通常チェックをすべて実行する。Actionsの実行用NodeとアプリのNode 22は別である。

月次と依存更新時に `npm audit` と `npm audit --omit=dev`、eslint pluginのpeerDependencies、Actions告知を確認する。未修正bracesのHigh 5経路は、件数を減らすためのダウングレードや検査の無効化で隠さない。詳細は [依存更新記録](dependency_security_updates.md)。通常の公開smokeは明示実行とし、外部学習ログ収集・有料監視サービスを導入しない。
