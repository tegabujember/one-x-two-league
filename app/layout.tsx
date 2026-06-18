import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "1X2 League - ליגת ניחושים",
  description:
    "ליגת ניחושים 1X2 - מתחברים עם Google, מצטרפים לליגה ומנחשים 1 / X / 2.",

  openGraph: {
    title: "1X2 League - ליגת ניחושים",
    description:
      "הצטרפו לליגת ניחושים 1X2, נחשו תוצאות משחקים וצברו נקודות לאורך הטורניר.",
    siteName: "1X2 League",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "1X2 League - ליגת ניחושים",
    description:
      "הצטרפו לליגת ניחושים 1X2, נחשו 1 / X / 2 וצברו נקודות.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
