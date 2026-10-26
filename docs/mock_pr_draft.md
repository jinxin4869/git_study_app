# 模擬PRのDraftと準備完了

GitHub模擬演習では、作業中のPRをDraft（下書き）として扱えます。GitHub CLIの`gh pr ready --help`で作成・準備完了への変更と`--undo`の意味を確認し、このアプリではPR番号だけを指定する範囲を再現しています。実際のGitHubアカウントやリポジトリには接続しません。

```text
gh pr create --draft --title "Add login" --body "作業中" --base main
gh pr view 1
gh pr ready 1
gh pr ready 1 --undo
```

push済みのブランチ間に差分がある状態でDraftを作成します。`gh pr view`は状態にDraftを表示します。Draft中でも模擬レビューとCIの結果は記録できますが、承認済み・CI成功でもマージは拒否します。

`gh pr ready 1`はレビュー準備完了へ変更し、`--undo`はDraftへ戻します。これらの操作はファイル・コミット・baseブランチ・既存のレビュー/CI結果を変えません。準備完了後のマージでも、従来どおり最新コミットへの承認とCI成功を要求します。閉じたPR・マージ済みPRには使えず、同じ状態への重複変更や不正な引数はstateを変えずに拒否します。

PR番号を省略すると、従来の模擬コマンドと同じく#1を対象とします。実GitHub CLIの「現在ブランチのPRを選ぶ」動作・URL/ブランチ名による指定・実リポジトリの権限やプラン制約は再現しません。

Draft状態は明示checkpointとバックアップへ保存し、再開してもマージ制限を維持します。以前のDraft属性がない保存状態は従来の準備完了PRとして扱います。入力補完とhelpにも対応します。

G04の部分対応です。コメントスレッド・base変更・CODEOWNERS・保護ルールの設定・実ユーザーへのレビュー依頼はこのPRに含めません。

後続の[統合先変更](mock_pr_base_change.md)でbase変更と再確認を追加しました。上の「base変更は含めない」はDraft導入時点の履歴です。
