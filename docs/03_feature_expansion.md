# 機能拡張 (Phase 2)

## 概要
より高度なGit操作と実践的なシナリオをサポートするための機能拡張を行いました。

## 実装内容
1.  **高度なGit操作**
    -   **Reset**: `git reset` (--soft, --mixed, --hard) を実装し、履歴の巻き戻しをサポートしました。
    -   **Stash**: `git stash` (push, pop, list) を実装し、作業の一時退避をサポートしました。

2.  **リモートリポジトリシミュレーション**
    -   **Remote**: `git remote` (add, remove, -v) を実装しました。
    -   **Push/Pull/Fetch**: モックサーバー (`mockServers`) を介したリモート操作のシミュレーションを実装しました。これにより、リモート追跡ブランチ (`origin/main` 等) の概念を導入しました。

3.  **コンフリクト解消システム**
    -   **Merge Conflict**: 3-wayマージロジックを実装し、競合が発生した場合にコンフリクトマーカー (`<<<<<<<`, `=======`, `>>>>>>>`) をファイルに挿入するようにしました。
    -   **Conflict Solver UI (`src/components/conflict-solver.tsx`)**: ユーザーがGUIで「Current」「Incoming」「Both」を選択してコンフリクトを解消できる専用UIを実装しました。

## 成果物
-   拡張された `GitEngine` クラス
-   `src/components/conflict-solver.tsx`: コンフリクト解消UI
