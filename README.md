# Git Learning App (AIエディタ)

インタラクティブにGitを学習できるWebアプリケーションです。ブラウザ上で動作するGitシミュレーター、コミットグラフの可視化、そして実践的なシナリオを通じて、Gitの基本から応用までを学ぶことができます。

## 特徴

-   **ブラウザ内Gitシミュレーション**: サーバーサイドのGitに依存せず、ブラウザ上でコマンドを実行・学習できます。
-   **視覚的なフィードバック**: コミットグラフやファイルツリーがリアルタイムに更新され、操作の結果を直感的に理解できます。
-   **実践的なシナリオ**: 基本的なコミットから、ブランチ操作、マージ、コンフリクト解消まで、段階的に学べるレベルを用意しています。
-   **コンフリクト解消UI**: 実際の開発現場のようなGUIでのコンフリクト解消を体験できます。

## 動作環境

-   Node.js 18.17.0 以上
-   npm, yarn, pnpm, または bun

## セットアップ手順

プロジェクトをローカル環境で実行するための手順です。

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd AIエディタ
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## テストの実行

Vitestを使用したユニットテストを実行できます。

```bash
# テストを一度だけ実行
npm run test

# ウォッチモードで実行（開発中）
npx vitest
```

## ドキュメント

詳細な設計や実装内容については、`docs/` ディレクトリ内のドキュメントを参照してください。

-   [01_project_setup.md](docs/01_project_setup.md): プロジェクトセットアップ
-   [02_core_features.md](docs/02_core_features.md): コア機能の実装
-   [03_feature_expansion.md](docs/03_feature_expansion.md): 機能拡張
-   [04_content_expansion.md](docs/04_content_expansion.md): コンテンツ拡充
-   [05_cleanup_and_polish.md](docs/05_cleanup_and_polish.md): 仕上げと修正
-   [06_testing.md](docs/06_testing.md): テストの導入

## 技術スタック

-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **Animation**: Framer Motion, Canvas Confetti
-   **Testing**: Vitest
