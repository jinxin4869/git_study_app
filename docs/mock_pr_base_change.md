# 模擬PRの統合先変更（G04）

`gh pr edit [番号] --base <branch>`で、開いている模擬PRの統合先を変更します。番号省略時は従来と同じ#1です。変更先は仮想originへpush済みの別ブランチで、提案元と差分がある必要があります。同じ統合先、不明な参照、提案元自身、同じ提案元/統合先の重複PR、閉じた/マージ済みPR、不正な引数は状態を変えず拒否します。

base変更ではコミット・ローカルの作業内容・ブランチ先端・Draft状態を変更しません。この模擬環境では、統合先を改めて確認するため、それまでのレビューとCI結果を解除します。変更後の最新版へレビューとCIを記録してからマージします。保存checkpoint/バックアップでも新しいbaseと確認待ち状態を保持します。

新しい課題github-retargetでは、main向けの承認済みPRをreleaseへ変更します。release固有の文書を残し、mainには取り込まず、再確認してreleaseだけへマージします。helpと入力補完にも対応します。

出典：[GitHub CLIのgh pr edit](https://cli.github.com/manual/gh_pr_edit)、[GitHubのbase変更](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/changing-the-base-branch-of-a-pull-request)。実GitHubではレビュー失効・required checks・コメントの扱いは設定や差分にも依存します。このアプリの再確認条件を実サービスの一律の挙動として説明しません。

G04のうちDraftとbase変更・再確認までを部分完了とし、コメントスレッド、CODEOWNERS、保護ルール設定、実ユーザーへのレビュー依頼は残件です。実GitHubへ接続しません。
