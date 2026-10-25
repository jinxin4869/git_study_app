# cherry-pickの移植元記録

自由練習で`git cherry-pick -x <commit...>`を使うと、移植したコミットのメッセージ末尾に`(cherry picked from commit <移植元ID>)`を追記します。元のコミット自体は変更しません。`feature~1 feature`のように複数の対象を指定した場合、それぞれの移植元IDを記録します。範囲指定は未対応です。

```text
git cherry-pick -x feature~1 feature
git log
```

競合すると、解消内容を編集・`git add`してから`git cherry-pick --continue`で続行します。記録するメッセージと、後続コミットにも移植元を付ける設定を途中状態へ保存するので、明示checkpointやバックアップから再開できます。`--skip`は現在の移植を飛ばし、後続の移植元記録は維持します。`--abort`は開始前へ戻します。続行・中断・skipには`-x`や対象を再指定しません。

`-x`を省略した既存の操作は従来どおりです。メッセージは変わるため、特定メッセージとの完全一致を要求する既存演習ではその達成条件に従ってください。このPRでは教材の採点基準を緩めません。

公式の[git-cherry-pick](https://git-scm.com/docs/git-cherry-pick)を確認し、ローカルの実Gitでも`-x`付きで競合した後、解消・stage・continueしたコミットに移植元注記が残ることを比較しました。実GitのIDは通常SHA、この模擬環境は短い模擬IDを使用します。外部リポジトリへは接続しません。

G08のうち`-x`を部分対応します。範囲移植、range-diff、その他の高度な調査機能を完了扱いにはしません。
