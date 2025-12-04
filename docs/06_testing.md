# テストの導入

## 概要
アプリケーションの安定性を保証するために、ユニットテスト環境を構築し、主要なロジックのテストを実装しました。

## 実装内容
1.  **テスト環境のセットアップ**
    -   **Vitest**: 高速なユニットテストフレームワークとして導入しました。
    -   `vitest.config.ts` を作成し、エイリアス（`@/`）等の設定を行いました。

2.  **ユニットテストの実装**
    -   **GitEngineテスト (`src/engine/git-simulator.test.ts`)**:
        -   `init`, `add`, `commit` の基本動作を検証。
        -   `branch`, `checkout` の動作を検証（これに伴い `GitEngine` に不足していたコマンド実装を追加）。
    -   **ゴール判定テスト (`src/engine/goal-checker.test.ts`)**:
        -   `repo_initialized`, `file_exists`, `command_executed` 等の各ゴール条件が正しく判定されるかを検証。

## 成果物
-   `vitest.config.ts`
-   `src/engine/git-simulator.test.ts`
-   `src/engine/goal-checker.test.ts`
