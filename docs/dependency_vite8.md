# Vite 8更新PRの修正（2026-10-03）

対象: [PR #8](https://github.com/jinxin4869/git_study_app/pull/8)。基点はmain `38ed23d`（PR #7/#12取込済み）。最新mainをmergeし、既存の学習体験修正と依存更新を保持した。

## 原因と変更

CIの `file-states.test.ts` は `file-tree.tsx` を読み込む。Next用の `jsx: preserve` をVite 8のOxcも参照し、JSXが残ったためimport analysisで失敗した。

- テスト設定だけで `oxc.jsx.runtime: automatic` を指定する。Nextのtsconfigと本番のSWC設定は維持する。
- 設定を `vitest.config.mts` にし、aliasを `import.meta.url` と `fileURLToPath` で解決する。明示的ESMにより将来のnative config loaderに対する警告も解消する。
- テストの除外、期待値の緩和、警告を隠す環境変数は使わない。

[公式Vite 8移行資料](https://vite.dev/guide/migration#javascript-transforms-by-oxc)の変換設定を参照した。既存のesbuild JSX設定はVitestがOxc設定を提供する場合に無視されたため採用していない。

## 検証

Ubuntu 22.04 / Node 22.22.1で、lint、型チェック、unit621件（25ファイル）、Next本番build、`npm ls --all` が成功。設定のESM化後もlint/型/unit全件が成功した。

最終コミットの `npm ci`・build・Chromium4サイズ/Firefox/WebKitのE2Eは [PR checks](https://github.com/jinxin4869/git_study_app/pull/8/checks) とPR本文に記録する。既存の実Git比較・特殊名・状態保持テストを維持する。

npm 11.21.0での全依存監査はHigh 5件（終了1）。対象は既存のNext lint → fast-glob → micromatch → braces経路で、新しい警告はない。ESLint 9のdeprecatedと未修正版bracesの警告は別課題。本PRのmainマージと本番公開は行っていない。
