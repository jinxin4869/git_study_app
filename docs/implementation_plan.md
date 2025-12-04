# Git学習アプリ - 実装計画書

## 目標
Gitの基本操作から、実務で遭遇する複雑なシナリオ（ブランチ戦略、複雑なマージなど）までを学べるインタラクティブなアプリケーションを作成します。

## ユーザーレビュー必須事項
> [!IMPORTANT]
> **技術スタックの決定**: **Next.js** と **React** を使用した **Webアプリケーション** として構築することを推奨します。
> 理由:
> - インストール不要で手軽に利用可能。
> - Gitグラフの可視化やインタラクティブな操作を実現しやすい。
>
> この構成で進めます。

## 提案機能

### コアコンポーネント
1.  **ターミナルシミュレータ**: ユーザーがGitコマンドを入力する疑似ターミナル。
2.  **ビジュアライザ**: コミット、ブランチ、HEADの状態をリアルタイムで表示するグラフ。
3.  **シナリオエンジン**: 特定のゴールと初期状態を持つ「レベル」や「課題」をロードするシステム。

### コンテンツ構成
-   **初級**: `git init`, `git add`, `git commit`, `git status`
-   **中級**: `git branch`, `git checkout/switch`, `git merge` (fast-forward vs non-fast-forward)
-   **上級**: `git rebase`, `git cherry-pick`, `git reset`, コンフリクト解消, インタラクティブリベース
-   **実務シナリオ**: 「機能開発中に緊急バグ修正対応」「マージ前のコミット整理」など

## ターゲット層とレベルデザイン
ユーザーの習熟度に合わせて以下の3段階のステージを用意し、課題解決型でレベルアップしていくシステムを構築します。

1.  **初学者（First Time）**:
    -   Gitに初めて触れる人。
    -   **ゴール**: リポジトリの作成からコミットまでの基本フローを理解する。
    -   **内容**: `init`, `add`, `commit`, `status`, `log`

2.  **学習中（Learning）**:
    -   ある程度コマンドは知っているが、ブランチ操作やマージに不安がある人。
    -   **ゴール**: 自由にブランチを切り、並行作業を行い、統合できるようになる。
    -   **内容**: `branch`, `checkout/switch`, `merge` (Fast-forward/Merge Commit), `stash`

3.  **実務入門（Job Ready）**:
    -   実務で初めてチーム開発に参加する人。
    -   **ゴール**: コンフリクト解消や履歴の整理など、トラブルシューティングと綺麗な履歴作りを学ぶ。
    -   **内容**: `rebase`, `cherry-pick`, `reset`, `revert`, コンフリクト解消, Pull Requestフローの疑似体験

## 変更内容
### [プロジェクトセットアップ]
#### [NEW] [package.json](file:///Users/jinxin/Project/AIエディタ/package.json)
- 以下のコマンドでNext.jsプロジェクトを初期化しました。
  ```bash
  npx -y create-next-app@latest git-learning-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
  ```
- その後、ルートディレクトリにファイルを移動し、必要なUIライブラリ（`lucide-react`, `framer-motion`, `clsx`, `tailwind-merge`）を追加インストールしました。

### [コアエンジン]
#### [NEW] [src/engine/git-simulator.ts](file:///Users/jinxin/Project/AIエディタ/src/engine/git-simulator.ts)
- 実際のGitを使わずにGitの状態変化をシミュレートするロジック。

## 検証計画
### 自動テスト
- Gitシミュレーションロジックの単体テスト（`git commit` でグラフにノードが追加されるか等）。

### 手動検証
- シナリオをプレイし、学習効果と操作性を確認する。
