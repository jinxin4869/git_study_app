import type { Metadata } from "next";
import { fontPreloads } from './font-preloads';
import "./globals.css";

export const metadata: Metadata = {
  title: "Git学習アプリ | ブラウザで操作して学ぶ",
  description: "145の演習とブラウザ内の模擬Gitで、履歴・ブランチ・競合の復旧を学習。進捗保存と段階ヒントで続けて学べます。",
  metadataBase: new URL("https://git-study-app.vercel.app"),
  openGraph: { title: "Git学習アプリ", description: "ブラウザ内の模擬Gitで操作と復旧を学ぶ145演習", url: "https://git-study-app.vercel.app", locale: "ja_JP", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>{fontPreloads.map(href => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />)}</head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
