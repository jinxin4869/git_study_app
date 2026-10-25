# Third-party license texts

2026-10-25時点の、使用フォント3種類と`package.json`の直接依存10件のライセンス本文です。著作権表示と本文を改変せずに保存しています。詳細な出典・取得元コミット・対象バージョン・SHA-256は[sources.json](sources.json)を参照してください。

## Fonts

- [Geist — SIL Open Font License 1.1](fonts/geist-OFL.txt)
- [Geist Mono — SIL Open Font License 1.1](fonts/geistmono-OFL.txt)
- [Noto Sans JP — SIL Open Font License 1.1](fonts/notosansjp-OFL.txt)

## Direct packages

| Package | Version | License text |
| --- | --- | --- |
| @types/diff | 7.0.2 | [MIT](packages/types-diff.txt) |
| canvas-confetti | 1.9.4 | [ISC](packages/canvas-confetti.txt) |
| clsx | 2.1.1 | [MIT](packages/clsx.txt) |
| diff | 8.0.4 | [BSD-3-Clause](packages/diff.txt) |
| framer-motion | 12.23.24 | [MIT](packages/framer-motion.txt) |
| lucide-react | 1.49.0 | [ISCと同梱の追加表記](packages/lucide-react.txt) |
| next | 15.5.28 | [MIT](packages/next.txt) |
| react | 19.3.0 | [MIT](packages/react.txt) |
| react-dom | 19.3.0 | [MIT](packages/react-dom.txt) |
| tailwind-merge | 3.7.0 | [MIT](packages/tailwind-merge.txt) |

lucide-reactの文書にはFeather由来部分のMIT表示も含まれるため、全体をそのまま保持しています。各パッケージ・フォントの条件はリンク先の原文で確認してください。

ここまでの原文表は直接依存とフォントを対象にしています。推移的依存・開発依存・画像は以下のExtended inventoryで追跡します。アプリ本体のMITと第三者の資産を同一視せず、配布物や依存を更新した際に対象を再確認してください。配布境界と本文不足はリポジトリの`docs/dependency_license_audit.md`に記録しています。

## Extended inventory (2026-10-25)

- [macOS/ARM](dependencies/darwin-arm64.json), [Linux/ARM](dependencies/linux-arm64.json), [Linux/x64](dependencies/linux-x64.json): all 529 lockfile package locations; installed notices and metadata-only evidence are distinguished.
- [Version-pinned upstream evidence](upstream-evidence.json): additional source-repository texts for 25 packages; 9 remain publisher metadata/README context only. A build repository license is not a verdict on its bundled native libraries.
- [Pinned font binary provenance](font-binaries.json): all 135 self-hosted WOFF2 files, exact official source URLs and SHA-256.
- [Original icon and retired assets](assets.json), [project MIT](project-MIT.txt).
- [GNU LGPL 3.0](supplemental/LGPL-3.0.txt), [GNU GPL 3.0](supplemental/GPL-3.0.txt): supplemental primary texts for reviewing native component distribution.

`npm run licenses:check` verifies recorded scope and hashes; success does not certify permission or compliance for every distribution model. Details and remaining boundaries are in `docs/dependency_license_audit.md`.
