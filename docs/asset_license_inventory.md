# 資産とライセンスの棚卸し（2026-10-25）

対象はmain`5f6dd12`の`package.json`/lockfile、`src/app/layout.tsx`、`public/`です。D06のうちフォントと直接依存の文書を同梱し、未確認の出自や名義を明示します。全資産・全依存の権利確認が完了したとの記録ではありません。

## 確認して同梱したもの

- 本体は`LICENSE`がMIT、copyrightは`2025 Git Learning App Team`です。`package.json`のlicense/author/repositoryと対応していることを確認し、名義を推測で変更しません。
- `next/font/google`でGeist、Geist Mono、Noto Sans JPを使用します。Google Fonts公式リポジトリの固定コミット`e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`から、各familyのOFL本文を取得しました。ビルドが取得するフォントバイナリ自体のSHAと、このコミットとの対応付けは未作成です。
- インストール済みの直接依存10件について、パッケージ内のLICENSE/license/License.mdを著作権行を含め改変せずコピーしました。lucide-reactはFeather由来部分の表示も含めて保持します。
- [ライセンス一覧と原文](../public/licenses/README.md)、[出典・バージョン・SHA-256](../public/licenses/sources.json)を`public/licenses/`に置きます。Next.jsの公開物にも`/licenses/`として同梱されます。

確認したのは本文の出典、対象family/パッケージ、コピーの一致です。ライセンスや商標の条件を追加・削除したものではありません。

## 残る確認

| 対象 | 確認できた事実 | 残ること |
| --- | --- | --- |
| 本体copyright/author | LICENSEとpackage.jsonの名義は同じ | 実際の権利者をこの名義で表記する方針の確認 |
| public/icon.png | 最初に追加された履歴は`ccf6e64`。public URLで取得可能 | 制作者・制作方法・利用許諾の出典 |
| public/next.svg・vercel.svg | ファイルが存在し、srcからの参照は検出しなかった。public URLでは取得可能 | 出典・再配布条件・ロゴ/商標の扱い |
| public/file.svg・globe.svg・window.svg | ファイルが存在し、srcからの参照は検出しなかった | 出典・作者・利用許諾 |
| 推移的依存・開発依存 | lockfileに固定された依存が存在する | 全体のライセンス/NOTICEと、実際の配布物に含まれる対象の棚卸し |
| フォント | 使用familyと公式OFL本文を確認 | font binaryの固定と出典対応をビルド条件に合わせて確認 |

出自を確認できない画像を推測でMIT扱いにせず、今回の作業で削除や差し替えもしません。全件の法的な許諾を判定したものではありません。

## 更新時

依存やフォントを更新した場合は、対象バージョンの原文を確認し、同梱テキスト、READMEの一覧、sources.jsonの出典とSHA-256を同時に更新します。原文のcopyrightや追加表示を省略しないでください。推移的依存を追加で配布する場合や画像を使う場合は、上の残件も対象にしてください。
