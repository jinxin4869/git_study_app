# 依存ライセンスの確認記録（2026-10-25）

package-lock.jsonの529パッケージ位置（runtime候補67・開発依存462。条件付きOS別依存を含む）を集計しました。依存の宣言と配布物の使用条件を区別し、すべてをMITや許諾済みとして扱いません。

## 宣言されたライセンス

| SPDX表記 | lockfile上の件数 |
| --- | ---: |
| MIT | 396 |
| Apache-2.0 | 59 |
| MPL-2.0 | 25 |
| ISC | 19 |
| LGPL-3.0-or-later | 10 |
| BSD-2-Clause | 7 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| BSD-3-Clause | 3 |
| 0BSD | 2 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| BlueOak-1.0.0 | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |

## 収集した配布物の原文

| 環境 | インストール済み | 原文あり | 原文なし・metadataのみ |
| --- | ---: | ---: | ---: |
| darwin-arm64 | 407 | 389 | 18 |
| linux-arm64 | 412 | 390 | 22 |
| linux-x64 | 414 | 392 | 22 |

Next.js内のdist/compiledのLICENSE/NOTICEも収集します。原文はcontent hashで重複排除し、[各環境の一覧](../public/licenses/README.md)から元のパッケージ位置・version・resolved URL・npm integrity・本文SHA-256を追えます。未インストールのOS別配布物はnot-installedとして残し、確認済みの本文があるようには扱いません。

本文が同梱されない34種について追加調査し、25種はnpm gitHeadまたは公式の同版release tagを固定commitへ解決して、上流の文書を収集しました。[上流調査の結果](../public/licenses/upstream-evidence.json)に出典を残します。上流repoのLICENSEはパッケージの全バイナリの条件を保証しないため、ネイティブ配布物にはscopeを明記しています。

以下9種は固定版での独立した本文を確保できていません。ライセンス宣言と、取得できたpublisher READMEの該当箇所をcontextとして保存し、原文確認済みと区別しています。

| 対象 | version | 配布メタデータの宣言 |
| --- | --- | --- |
| @humanfs/types | 0.15.0 | Apache-2.0 |
| @types/json5 | 0.0.29 | MIT |
| client-only | 0.0.1 | MIT |
| esrecurse | 4.3.0 | BSD-2-Clause |
| keyv | 4.5.4 | MIT |
| language-subtag-registry | 0.3.23 | CC0-1.0 |
| language-tags | 1.0.9 | MIT |
| natural-compare | 1.4.0 | MIT |
| stable-hash | 0.0.5 | MIT |

## 配布境界で確認するもの

- Sharp/libvipsのネイティブ配布物にはLGPL等の複数ライブラリが含まれます。ビルド用repoのApache等の原文を、ネイティブbinary全体のライセンスと取り違えません。publisher READMEとversions.json、GNU公式の[LGPL原文](../public/licenses/supplemental/LGPL-3.0.txt)・[GPL原文](../public/licenses/supplemental/GPL-3.0.txt)を参照して、実際に配布するbinaryとそのsource・noticeの条件を確認する必要があります。
- MPLのaxe-core/lightningcss、CC-BYのcaniuse-lite、Python/CC0等も宣言ごとに記録しています。runtime候補にはビルド時にしか使われないものもあり、ブラウザへ全件を配信するという意味ではありません。
- このPRはnative binary自体をpublicへコピーしません。NPM配布物/サーバー成果物/ブラウザ資産の使用条件は、配布形態と対象バージョンに応じて確認します。この棚卸しは全配布形態の許諾判定ではありません。

## 維持する手順

`npm run licenses:inventory`で実行環境の一覧を更新し、`npm run licenses:check`でlockfile・本文・フォント・独自SVGの整合性を検査します。3環境を更新する場合はmacOS/ARM、Linux/ARM、Linux/x64それぞれで同じlockfileからnpm ciして収集します。Linux/x64はnode:22-bookworm-slim、Linux/ARMは既存Playwrightコンテナで収集しました。収集時に依存のinstall scriptsは実行不要です。

CIには整合性検査と収集器の6テストを追加しました。検査成功は棚卸しの整合性であり、未調査の権利を自動承認するものではありません。フォント/アイコンを意図して変更した場合も、出典・本文・hashを一緒に更新してください。
