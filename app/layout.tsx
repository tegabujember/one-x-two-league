import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getThemeInitScript } from "@/components/theme/theme";
import {
  DEFAULT_LANGUAGE,
  getLanguageInitScript,
  isLanguage,
  LANGUAGE_DIRECTIONS,
  LANGUAGE_STORAGE_KEY,
} from "@/lib/i18n/config";
import { he } from "@/lib/i18n/dictionaries/he";
import { en } from "@/lib/i18n/dictionaries/en";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function getRequestLanguage() {
  const storedLanguage = (await cookies()).get(LANGUAGE_STORAGE_KEY)?.value;
  return isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const dictionary = language === "en" ? en : he;

  return {
    metadataBase: new URL("https://one-x-two-league.vercel.app"),
    applicationName: "World Cup League 2026",
    title: dictionary["metadata.title"],
    description: dictionary["metadata.description"],
    appleWebApp: {
      capable: true,
      title: "World Cup League 2026",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: dictionary["metadata.title"],
      description: dictionary["metadata.socialDescription"],
      siteName: "1X2 League",
      type: "website",
      url: "https://one-x-two-league.vercel.app",
      images: [
        {
          url: "https://one-x-two-league.vercel.app/og-image.jpg",
          width: 1200,
          height: 630,
          alt: dictionary["metadata.title"],
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary["metadata.title"],
      description: dictionary["metadata.twitterDescription"],
      images: ["https://one-x-two-league.vercel.app/og-image.jpg"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLanguage = await getRequestLanguage();

  return (
    <html
      lang={initialLanguage}
      dir={LANGUAGE_DIRECTIONS[initialLanguage]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="language-init"
          dangerouslySetInnerHTML={{ __html: getLanguageInitScript() }}
        />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLanguage={initialLanguage}>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
