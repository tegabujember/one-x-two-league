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
  metadataBase: new URL("https://one-x-two-league.vercel.app"),

  title: "1X2 League - ליגת ניחושים",
  description:
    "ליגת ניחושים 1X2 - מתחברים עם Google, מצטרפים לליגה ומנחשים 1 / X / 2.",

  openGraph: {
    title: "1X2 League - ליגת ניחושים",
    description:
      "הצטרפו לליגת ניחושים 1X2, נחשו תוצאות משחקים וצברו נקודות לאורך הטורניר.",
    siteName: "1X2 League",
    type: "website",
    url: "https://one-x-two-league.vercel.app",
    images: [
      {
        url: "https://one-x-two-league.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "1X2 League - ליגת ניחושים",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "1X2 League - ליגת ניחושים",
    description:
      "הצטרפו לליגת ניחושים 1X2, נחשו 1 / X / 2 וצברו נקודות.",
    images: ["https://one-x-two-league.vercel.app/og-image.jpg"],
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
