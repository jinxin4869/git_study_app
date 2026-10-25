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

この一覧は推移的依存、開発依存、画像/商標等を網羅したものではありません。アプリ本体のMITと第三者の資産を同一視せず、配布物や依存を更新した際に対象を再確認してください。画像の出自と残る確認はリポジトリの`docs/asset_license_inventory.md`に記録しています。
