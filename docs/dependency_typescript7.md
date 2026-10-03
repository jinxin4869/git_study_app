# TypeScript 7更新PRの修正（2026-10-03）

対象: [PR #9](https://github.com/jinxin4869/git_study_app/pull/9)。最新main `38ed23d`（PR #7/#12取込済み）が基点に含まれる。

## 原因と変更（初回修正）

TypeScript 7.0はCLIを提供するが、typescript-eslintとNextが必要とする従来のJavaScript APIを提供しない。そのため元のPRはlint開始時に失敗した。

[TypeScript公式の併用方法](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0)に従い、npm aliasで用途を分ける。

- `@typescript/native: npm:typescript@^7.0.2`: `tsc` と `npm run typecheck` は7.0.2のnative CLIを使用する。
- `typescript: npm:@typescript/typescript6@^6.0.2`: lint、Next build、Next言語プラグインはTypeScript 6 APIを使用する。`tsc6` も利用でき、`tsc` の名前は競合しない。
- TypeScript 7で有効になる副作用importの検査に対応し、Next bundlerが扱うCSSの型宣言を `src/types/styles.d.ts` に追加する。検査自体は無効化しない。

aliasパッケージは6.0.2、ローカルで `require('typescript').version` が返すAPIは6.0.3。native CLIの `tsc --version` は7.0.2と確認した。TypeScript 7だけですべてのツールが動くという扱いにはしない。APIを必要とするツールの将来の対応後にこの併用を再検討する。

## 検証

Ubuntu 22.04 / Node 22.22.1で、lint、TypeScript 7の型チェック、unit621件（25ファイル）、Next本番build、`npm ls --all` が成功。既存の実Git比較・特殊名・状態保持テストを維持する。

最終コミットのクリーンインストールとChromium4サイズ/Firefox/WebKitのE2Eは [PR checks](https://github.com/jinxin4869/git_study_app/pull/9/checks) とPR本文に記録する。lint/buildをスキップしたり、peer依存を無視したりしていない。

npm 11.21.0での全依存監査はHigh 5件（終了1）。対象は既存のNext lint → fast-glob → micromatch → braces経路で、新しい警告はない。ESLint 9のdeprecatedと未修正版bracesの警告は別課題。本PRのmainマージと本番公開は行っていない。

## main更新後の競合解消（2026-10-03）

PR #8/#11のマージ後のmain `f923cd2` を取り込み、package.jsonとpackage-lock.jsonの競合を解消した。Vite 8.3.1、Lucide 1.49.0、Oxcのautomatic JSX変換とvitest.config.mtsを保持する。

本PRのTypeScript 7 CLI/TypeScript 6 APIの併用とCSS型宣言を保持する。Vitestはmainと同じ4.1.11。

最新mainのlockfileを基点にnpm 11.21.0で通常のpeer解決により再生成した。npm ci、lint、型チェック、unit621件（25ファイル）、npm ls --allが成功。競合マーカーや未解消ファイルを残さず、peer無視・履歴書換え・検査無効化は行わない。

この再同期の最終コミットに対するbuild/E2E/Previewと対象SHAは [PR checks](https://github.com/jinxin4869/git_study_app/pull/9/checks) とPR本文を参照する。初回CI成功記録とは区別する。mainへのマージと本番公開は行っていない。
