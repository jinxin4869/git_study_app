# 依存関係のセキュリティ更新（2026-10-03）

残作業ロードマップのF09を、`fix/dependency-security-updates`で対応した。F01〜F08の修正済みコミット`7766b49`を基点としている。

## 主要な更新

| パッケージ | 更新前のlockfile | 更新後のlockfile |
| --- | --- | --- |
| Next.js | 15.5.8 | 15.5.27 |
| React / React DOM | 19.2.0 | 19.2.7 |
| diff | 8.0.2 | 8.0.4 |
| Vitest | 4.0.12 | 4.1.11 |
| Vite | 7.2.4 | 7.3.6 |
| Rollup | 4.53.3 | 4.64.0 |
| ESLint | 9.39.1 | 9.39.5 |
| eslint-config-next | 16.0.3 | 16.3.8 |
| typescript-eslint | 8.47.0 | 8.71.0 |
| PostCSS（全経路） | 8.5.6 / Next.js内8.4.31 | 8.5.28 |
| sharp | 0.34.5 | 0.35.5 |

Next.jsは[公式の9月セキュリティ更新](https://nextjs.org/blog/september-2026-security-release)の15系修正版を使う。ReactとReact DOMも同じ19.2系のパッチへ揃えた。Vitestは[redirect mockの修正](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)を含む4.1.11に更新した。

Vitestが使うViteは、既存のTSXテスト設定に対応する7系をdevDependenciesに明示した。Next.jsがPostCSS 8.4.31を固定しているため、`overrides.postcss`で同じ8系の修正版8.5.28を全経路に適用した。Next.jsが修正版を指定するようになった時点で、このoverrideを再検討する。

Babel、humanfs、ajv、baseline-browser-mapping、brace-expansion、browserslist、flatted、js-yaml、minimatch、nanoid、picomatchも互換範囲の修正版へ更新した。既存のESLintのフラット設定とReact Hooksの検査を維持するため、eslint-config-nextは現在使っている16系を更新している。

## npm監査の比較

更新前の`package.json`とlockfileを一時ディレクトリに取り出し、更新後と同じ日にnpmレジストリで監査した。表の件数は、間接依存から伝播する警告を含むパッケージ単位の件数であり、独立した脆弱性の数ではない。

| 対象 | 更新前 | 更新後 |
| --- | --- | --- |
| 本番依存（`npm audit --omit=dev`） | 5（Critical 1 / High 3 / Low 1） | 0 |
| 全依存（`npm audit`） | 30（Critical 2 / High 22 / Moderate 4 / Low 2） | 5（すべてHigh、開発用依存） |

### 残る警告

残る5パッケージは、次の一つの依存経路に由来する。

```text
eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces
```

`braces@3.0.3`の深くネストしたglobパターンによるスタック枯渇に対して、[公開済みの修正版はまだない](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。この経路は開発用のESLint設定に含まれる。本番依存の監査対象には入らないが、開発用の警告としては未解決であり、修正版・親ライブラリの対応後に再監査する。

ESLint 9系は[2026-08-06にサポート終了](https://eslint.org/version-support/)している。今回は9系の最終版を採用した。現在のeslint-plugin-react 7.37.5、eslint-plugin-jsx-a11y 6.10.2、eslint-plugin-import 2.32.0のpeerDependenciesはESLint 10を含まないため、10系への移行はこれらの対応と併せて進める必要がある。インストール時のESLintのdeprecated警告は残る。

## 再現と検証

Node.js 22.22.1 / npm 10.9.4で`npm ci`から再インストールした。Viteの要件に合わせ、package.jsonのNode.js要件を20.19以上の20系、22.12以上の22系、または24以上に明示し、READMEも更新した。CIと同じ22系の最新パッチを推奨する。

lockfileの更新には一時的にnpm 11.21.0を使用した。npm 10の依存解決処理がVitestの更新中に内部例外で停止したためで、通常のインストールとCIでは従来どおり`npm ci`を使える。

```bash
# 依存の更新を行う場合
npm exec --yes --package=npm@11.21.0 -- npm install

# lockfileからの再インストールと確認
npm ci
npm audit --omit=dev
npm audit
npm ls --all
npm test
npm run lint
npm run typecheck
npm run build
CI=1 npm run test:e2e -- --workers=2 --retries=0
```

- `npm ci`成功。本番監査は終了コード0、全依存の監査は残る5件により終了コード1。
- `npm ls --all`は終了コード0。invalid・missing・peer依存の不整合はない。Linuxで未使用のSharp WASM用任意依存2件（`@img/sharp-wasm32`、`@emnapi/runtime`）はextraneousとして表示される。
- ユニットテスト325件、lint、型チェック、本番ビルドが成功。
- Chromiumのdesktop・mobile・narrow・tabletのE2E 76件が成功。更新した本番ビルドから新しくサーバーを起動し、再試行なしで確認した。

本番への公開、Firefox・WebKit、実機IMEの確認は今回の範囲に含まれない。


## 学習体験改善時の再監査（2026-10-03 JST）

最新origin/main `ea90e1d` を基点に、ユーザーの依存メタデータ送信許可を得てnpmレジストリへ再監査した。本番は0件（終了コード0）、全依存はHigh 5件（終了コード1）で上記と同じ。`braces`の[告知](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)も再確認し、修正版はNoneだった。深くネストした攻撃者のglobパターンがbracesの再帰解析へ渡るとNodeプロセスのスタックを枯渇させる。ブラウザの演習入力がESLintのglob解析へ渡る経路はなく、この依存経路は開発lintに限られる。開発依存の警告は未解決として残す。

監査のfixAvailableは`eslint-config-next@14.2.35`へのメジャー変更を示すが、検査互換性を崩して件数だけ減らす更新は採用しなかった。lint/型/テスト/buildの無効化は行っていない。bracesまたは親依存の修正と、ESLint 10対応pluginの移行はO04の後回し課題。今回lockfileの依存バージョン変更なし。

今回もユニット494件、lint・型・本番ビルド、Chromium4サイズ/Firefox/WebKitのE2E計192件が成功した。アプリ検証は[学習体験改善の記録](learning_experience.md)を参照する。

## 学習説明・操作性改善時の再確認

2026-10-03 JST、基点 `a94b380` と今回のlockfileを確認。`npm audit`はHigh 5件で終了コード1、`npm audit --omit=dev`は0件で終了コード0。本番/開発の集計を分け、既存の履歴は保持する。

依存経路は引き続き `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`。[bracesの公式告知](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)は修正版なし。深く入れ子になったbrace patternをNodeで解析するとstack overflowによる停止が起きる。アプリの学習コマンド/ファイル内容はこの開発用glob経路へ渡さず、通常のブラウザ学習がこの告知の入力条件を満たすとは確認していない。信頼しないパターンを扱うlint/toolingでは残課題となる。

最新eslint-plugin-react/jsx-a11y/importのpeerDependenciesはESLint 10を含まないことをnpm registryで再確認した。監査の候補 `eslint-config-next@14.2.35` への互換性を崩す変更は採用しない。修正版または親依存/plugin対応が出た時に移行を検証する。

アクセシビリティE2Eの実行依存を明確にするため、既にlockfileに存在するaxe-core 4.11.0を直接devDependencyにも指定した。依存バージョン変更はなく、npm 10の再生成で省かれたplatform libcメタデータを保持した。

CIは [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node)、[upload-artifact](https://github.com/actions/upload-artifact) をv7へ更新した。公式のNode 24実行ランタイムとubuntu-latestでの互換性を確認し、アプリ用Node 22の指定は維持する。最終的な実行結果は今回のPR checksと [改善記録](learning_refinements.md) に記録する。月次Dependabotと手動監査の手順を [runbook](release_runbook.md) に設定し、検査の無効化やaudit --forceは行わない。
