import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataViz.jp ビデオ (Beta)",
  description: "データ可視化特化型動画サブスクリプションサービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Analytics />
        <Script src="https://id.data-viz-lectures.com/lib/supabase.v1.js" strategy="beforeInteractive" />
        <Script src="https://id.data-viz-lectures.com/lib/dataviz-auth-client.v1.js" strategy="afterInteractive" />

        <SiteHeader />

        {children}
      </body>
    </html>
  );
}
