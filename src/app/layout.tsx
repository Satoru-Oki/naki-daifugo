import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
});

export const metadata: Metadata = {
  title: "鳴き大富豪 - NAKI DAIFUGO",
  description: "大富豪 × 麻雀の「読み」= 新感覚カードゲーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${fredoka.variable} antialiased`}>{children}</body>
    </html>
  );
}
