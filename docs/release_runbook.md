# 公開確認と戻し方

用途は個人向けブラウザ学習。公開先は [Git Learning App](https://git-study-app.vercel.app)。学習内容・完了記録はブラウザ内にあり、実GitHub・実リポジトリへの接続や学習ログの外部収集は行わない。

## PRから公開まで

1. 最新mainから作業し、PRの目的・見える挙動・テスト・保存互換性・未検証範囲を記録する。
2. `npm ci`、lint、typecheck、unit、本番build、Playwright 6構成を確認する。CIはUbuntu 24.04の標準OS依存付きChromium/Firefox/WebKitを使う。再試行でのみ通った経路はログから確認する。
3. VercelのPR Previewのビルド状態と対象SHAを確認する。SSO等で画面を開けない場合、成功したビルドだけで画面確認済みとはしない。アクセス可能な担当者が主要経路を確認する。
4. レビュー後、所有者がmainへマージする。作業エージェントはmainへ直接push、マージ、手動デプロイをしない。
5. main連携によるProduction deploymentがReadyになったら、対象SHA・URL・日時・CI run URLを記録する。保護されたdeployment固有URLと公開aliasは別に確認する。
6. 公開aliasに対して、次の明示的な本番smokeを実行する。テストは新規ブラウザプロファイルを使い、そのプロファイルのlocalStorageだけを変更する。公開先へデプロイせず、GitHubの実PRも作成しない。

```bash
npm run test:e2e:production
# 認証なしでアクセスできる別の確認先を指定する場合
PRODUCTION_BASE_URL=https://git-study-app.vercel.app npm run test:e2e:production
```

この設定はwebServerを起動せず、通常のCI E2Eから分離する。ホーム→演習→ヒントなし達成、選択/完了の再読込とGitの初期化、リセットと記録削除の区別、複数タブ、失敗入力、rebase中断、プレビューのフォーカス復帰、端末の追従停止/再開、達成解説と次の演習をPC/390px幅で確認する。さらに保存読取失敗からの回復、通常のマーカー文章による誤合格の拒否、stash競合の編集→stageと採点説明の一致を確認する。現在は9フロー×2構成の18件。今後の意図的なUI変更でsmokeも変わる場合、公開済み版に適用できるテストとPR版用テストを区別する。部分削除・容量不足等の広い経路は通常E2E/ユニットも維持する。

実機IME、ソフトキーボード、実読み上げ、Safari、ブラウザの200%ページズームは担当者の端末で確認し、OS/ブラウザ/入力方式と結果を記録する。[実機確認の手順と結果票](manual_device_checks.md)を使う。自動WebKit・文字サイズ200%・合成IMEの成功では代用しない。

## 問題発生時

- 記録する情報：公開URL、deployment/SHA、日時、OS/ブラウザ、演習ID、開始状態、実行コマンド、期待結果/実際の結果、保存警告、再現の可否。必要なスクリーンショットだけを添付し、個人情報や実資格情報は記載しない。
- 保存失敗：ブラウザの保存許可/容量を確認し、ページを閉じる前に「保存を再試行」。Gitリセットは保存記録の削除ではない。壊れた記録は範囲を確認してアプリ内の削除操作で復旧する。他サイトの保存を全消去する手順を案内しない。
- Gitの試行をやり直す：「現在の演習を最初からやり直す」。途中Git/端末は保存されず、完了記録は残る。
- 公開版の障害：まず対象deploymentと正常版を特定する。公開権限を持つ所有者がVercelのDeploymentsから正常なProduction deploymentを選び、Instant Rollbackを行う。対象SHA/URLを確認し、戻した後に公開smokeと保存互換性を確認する。

[Vercel公式のInstant Rollback](https://vercel.com/docs/instant-rollback)では、以前のビルドへ公開先を戻す。環境変数やデータの変更を自動で元に戻す手段ではない。プランによる対象deploymentの制約を画面で確認する。今回は障害対応の必要がないため、実際の本番rollbackは実行していない。

継続的なコード修正はmainの履歴を強制書き換えず、修正/必要なrevertを別PRとしてレビューする。ロールバック後の自動公開状態をVercelの画面で確認し、再公開は所有者の判断で行う。

## 保存・教材の互換性

現行main `4c11917` はPR #5以降のversion 1、同じキー、同じselection/complete/hintの型を維持する。GitState・端末を新たに保存しない。PR #12では基点 `cd3272d` と旧→新/新→旧の双方向互換性を検証した。依存更新と今回の公開確認は保存形式を変更しない。将来変更する時も双方向の結果を記録する。公開オリジンが違うPreviewには本番のlocalStorageは共有されない。

採点を厳密化しても、過去の完了日時は削除しない。完了記録は当時の達成履歴であり、現在の試行は初期状態から新しい基準で再採点する。記録があることだけで現在の状態を合格にしない。

将来version 2や途中状態を保存する場合、旧データの移行、未知版の上書き拒否、ID変更、容量不足、複数タブ、旧版への戻し方を実装・テストしてから公開する。旧版が読めない新形式を同じキーへ上書きする更新は行わない。

## 継続保守

Dependabotはnpm/GitHub Actionsの更新を月次で通知する。npmのminor/patchをまとめ、majorは互換性を別にレビューする。PRごとに通常チェックをすべて実行する。Actionsの実行用NodeとアプリのNode 22は別である。

月次と依存更新時に本番/全依存の監査、eslint pluginのpeerDependencies、Actions告知を確認する。実行コマンド・結果の判定・更新条件は [依存更新記録の最新節](dependency_security_updates.md#依存更新pr取込後の再監査2026-10-04-jst)。npm 10の監査endpointエラー時は記載のnpm 11 CLIを使い、エラーを0件と扱わない。未修正bracesのHigh 5経路は、件数を減らすためのダウングレードや検査の無効化で隠さない。次回月次確認目安は2026-11。通常の公開smokeは明示実行とし、外部学習ログ収集・有料監視サービスを導入しない。

CIのOSメジャーは `ubuntu-24.04` として固定し、runnerのパッチイメージは通常更新される。ubuntu-latestのOSメジャー移行でWebKitのOS依存が変わることを避け、OS更新は公式runner/Playwright対応と6構成テストを確認して別PRで行う。

## PR #6取込後の公開確認（2026-10-03 JST）

この節は `cd3272d` の確認履歴。依存更新とPR #12取込後の現状は末尾の2026-10-04節を参照する。

[PR #6](https://github.com/jinxin4869/git_study_app/pull/6)は2026-10-03 07:26:09 UTCにマージ済み。マージSHAは `cd3272dbff8f8be486b2acf4fb56cf34b3b45d14`。mainの [Tests 37106344391](https://github.com/jinxin4869/git_study_app/actions/runs/37106344391) と [37106344588](https://github.com/jinxin4869/git_study_app/actions/runs/37106344588) は同じSHAで成功している。

GitHub deployment `6824782584`、environment `Production`、同SHAのsuccessを2026-10-03 07:27:03 UTCに確認した。deployment固有URLは [git-study-ri9niabwb](https://git-study-ri9niabwb-jinxin1024s-projects.vercel.app)。公開画面は認証なしの [公開alias](https://git-study-app.vercel.app) で確認した。固有URLの保護された画面を操作確認済みとはしない。

公開smokeを6フロー×PC/390px幅の12件へ拡張し、再試行0で成功。以前の4フローに、過去ログの追従停止/再開と、課題別の達成理由/前提/次のおすすめを追加した。テスト用ブラウザ内の保存以外に書き込みはなく、実GitHub操作/デプロイは実行していない。

**`fix/post-merge-learning-reliability` の追加修正はこの公開版にまだ含まれない。** 修正後の検証はlocalhost本番ビルド/PR CIで行い、公開後は新しいdeployment/SHAを確認してsmokeを再実行する。残る実機確認と詳細は [再評価記録](post_merge_review.md)。

### 保存例外の復旧と監査エラー

- 読み取れないだけの既知完了表示は保持する。初回起動で読めない記録を復元できたとは扱わない。ブラウザの許可/容量を確認し「保存を再試行」する。読取が回復した後は別タブの実削除も反映する。
- 削除途中に失敗した場合、可能な範囲で記録を戻す。削除失敗時は警告へフォーカスし小画面でも表示する。「もう一度削除」の案内が出たら許可を確認し、同じ削除確認の「削除する」を使う。戻す書込も失敗した場合は、一部削除の可能性を通知する。保存再試行は削除の再実行ではない。
- rollbackは複数キーの強い原子性を保証しない。戻す時に既にある別タブの記録は置き換えない。削除/保存を同じIDで同時実行する場合は最後の操作が反映される。
- npm 10の監査がquick endpoint HTTP 400で失敗した場合、その結果を0件と扱わない。[依存監査記録](dependency_security_updates.md)のnpm 11 CLIで監査を再実行する。lockfileを書き換えたり検査を無効化して復旧しない。

## 依存更新・PR #12取込後の公開確認（2026-10-04 JST）

現在のProductionは `4c119178b2f1df4fffc4382edf409c9abe12e2bb`、deployment `6829693868`。PR #12と依存更新PR #7〜11はmainへ取込済みで、上の旧記録の「追加修正はまだ含まれない」は解消した。mainの[CI 37134560373](https://github.com/jinxin4869/git_study_app/actions/runs/37134560373)は同SHAでsuccess。

公開aliasに対して18件（9フロー×PC/390px幅）が再試行0で成功した。保存読取障害の回復、失敗merge/通常マーカーで合格しないこと、stash競合のstageと達成条件の一致を追加した。対象URL・SHA・時刻・範囲は[公開確認記録](post_release_verification.md)。実機の確認は引き続き未完了、実rollbackも障害がないため実施していない。
