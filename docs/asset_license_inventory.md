# 資産とライセンスの棚卸し（2026-10-25更新）

対象はmain`5f6dd12`とPR#27の更新分です。プロジェクトの名義・画像・フォント・直接/推移的/開発依存を分けて確認しました。

## 本体と独自アイコン

- 本体はMIT、copyright/authorはGit Learning App Teamです。今回、所有者からこの表記でよいと確認を得ました。最初の著作権年2025は維持します。
- 出典記録のないpublic/icon.pngと初期テンプレートのSVG5個、favicon.icoを現行の配信対象から外しました。旧ファイルのhashと退役を[assets.json](../public/licenses/assets.json)に記録します。Git履歴の削除は行いません。
- 新しいsrc/app/icon.svgはCodexによる生成AI支援で新規に記述したSVGです。外部の画像・ロゴは取り込まず、Git Learning App Team・MITの表示とhashを記録しました。所有者から生成AIと名義の利用方針を確認しています。AI生成に関する権利を一律に保証するとの意味ではありません。
- [本体MIT原文](../public/licenses/project-MIT.txt)を公開物にも同梱しました。

## 使用フォント

Geist、Geist Mono、Noto Sans JPのOFL原文はGoogle Fonts公式の固定commit`e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`から取得したものを維持します。

既存のNext.jsビルドが配信していた135個のWOFF2について、同じUser-Agentで得た公式Google Fonts CSSの配布URLと実際のバイナリをSHA-256で照合しました。[font-binaries.json](../public/licenses/font-binaries.json)に元URL・CSS hash・バイナリhash・family・preload対象を記録しています。

同じ135バイナリをpublic/fontsへ固定し、138個のfont-face（fallback3個を含む）のUnicode範囲・weight・swap・fallback metricsと3個のLatin preloadを保って自前配信します。ビルド時のGoogle Fonts再取得をなくし、ファイル名がhashのフォントだけをimmutableで配信します。約5.6MBのフォントをリポジトリへ追加しますが、各ページでUnicode範囲に応じたファイルだけをロードします。

## 依存と確認範囲

直接依存10件の本文を残した上で、[全依存の確認記録](dependency_license_audit.md)と3環境のlockfile529件の一覧、本文/NOTICE、上流の固定版の出典を追加しました。LGPL・MPL・CC-BY等を個別に記録し、標準的なMIT条件と混同しません。

D06の対象だった名義・現行画像の出典・フォントのバイナリ対応・推移的/開発依存の棚卸しに対応しました。9種の本文不足とnative binary等の配布形態ごとの条件は、監査記録に残しています。全配布形態の法的な許諾を一括で認定したものではありません。

## 更新時

`npm run licenses:inventory`と`npm run licenses:check`を使い、依存・原文・出典・hashを同時更新します。収集器はロックの範囲、本文改変、版違い、外部symlink、パス逸脱、フォント/資産の不一致を検査します。CIでも検査を行います。
