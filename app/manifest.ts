import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_DIRECTIONS,
  LANGUAGE_STORAGE_KEY,
} from "@/lib/i18n/config";
import { he } from "@/lib/i18n/dictionaries/he";
import { en } from "@/lib/i18n/dictionaries/en";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const storedLanguage = (await cookies()).get(LANGUAGE_STORAGE_KEY)?.value;
  const language = isLanguage(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE;
  const dictionary = language === "en" ? en : he;

  return {
    name: "World Cup League 2026",
    short_name: "1X2 League",
    description: dictionary["manifest.description"],
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: language,
    dir: LANGUAGE_DIRECTIONS[language],
    theme_color: "#020617",
    background_color: "#020617",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
