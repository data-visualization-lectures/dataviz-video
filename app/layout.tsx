import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
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
        {/* Google Tag Manager */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-KC67K4W9P1" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-KC67K4W9P1');
          `}
        </Script>
        <Script src="/lib/supabase.js" strategy="beforeInteractive" />
        <Script src="/lib/dataviz-auth-client.js" strategy="afterInteractive" />

        <SiteHeader />

        {children}
      </body>
    </html>
  );
}
