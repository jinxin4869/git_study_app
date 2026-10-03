import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const japanese = Noto_Sans_JP({
  variable: "--font-japanese",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Git学習アプリ | ブラウザで操作して学ぶ",
  description: "139の演習とブラウザ内の模擬Gitで、履歴・ブランチ・競合の復旧を学習。進捗保存と段階ヒントで続けて学べます。",
  metadataBase: new URL("https://git-study-app.vercel.app"),
  openGraph: { title: "Git学習アプリ", description: "ブラウザ内の模擬Gitで操作と復旧を学ぶ139演習", url: "https://git-study-app.vercel.app", locale: "ja_JP", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${japanese.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
