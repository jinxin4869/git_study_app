# コア機能の実装

## 概要
Git学習アプリケーションの中核となるシミュレーションエンジンと可視化機能を実装しました。

## 実装内容
1.  **Gitコマンドシミュレーションエンジン (`src/engine/git-simulator.ts`)**
    -   ブラウザ上で動作する軽量なGitエミュレータを実装しました。
    -   **サポートコマンド**: `init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `merge`。
    -   **状態管理**: コミット履歴、ブランチ、インデックス（ステージングエリア）、ワーキングディレクトリの状態をメモリ上で管理します。

2.  **Gitグラフ可視化コンポーネント (`src/components/git-graph.tsx`)**
    -   SVGとFramer Motionを使用して、コミット履歴を視覚的に表示するコンポーネントを作成しました。
    -   コミットノード、親子関係のリンク、ブランチラベル、HEADの位置を動的に描画します。

3.  **シナリオ/レベルシステム (`src/engine/scenarios.ts`)**
    -   学習コンテンツを管理するシステムを構築しました。
    -   各レベルに「目標（Goal）」を設定し、ユーザーの操作が目標を満たしたかを判定するロジックを実装しました。

## 成果物
-   `src/engine/git-simulator.ts`: Gitロジックの中核
-   `src/components/git-graph.tsx`: 履歴可視化UI
-   `src/engine/scenarios.ts`: 学習シナリオ定義
