# コンテンツ拡充

## 概要
初心者から中級者まで学べる全7レベルの学習シナリオを作成しました。

## 実装内容
各レベルは `src/engine/scenarios.ts` に定義されています。

1.  **Level 1: 基本操作**
    -   `git init`, `git add`, `git commit` の基本的な流れを学習。
2.  **Level 2: ブランチ**
    -   `git branch`, `git checkout` を使用したブランチの作成と切り替え。
3.  **Level 3: マージ**
    -   `git merge` を使用したブランチの統合（Fast-forward）。
4.  **Level 4: Stash**
    -   `git stash` を使用して作業中の変更を一時退避し、別の作業を行うフロー。
5.  **Level 5: Reset**
    -   `git reset --hard` を使用して間違ったコミットを取り消す方法。
6.  **Level 6: Detached HEAD**
    -   特定のコミットにチェックアウトし、Detached HEAD状態を体験。
7.  **Level 7: コンフリクト解消**
    -   意図的にコンフリクトが発生する状況を作り出し、手動で解消してマージコミットを作成する実践演習。

## 成果物
-   `src/engine/scenarios.ts`: 全7レベルのシナリオデータ
