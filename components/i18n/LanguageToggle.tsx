"use client";

import { useLanguage } from "./LanguageProvider";
import type { Language } from "@/lib/i18n/config";

const languageOptions: Array<{
  value: Language;
  labelKey: "language.hebrew" | "language.english";
}> = [
  { value: "he", labelKey: "language.hebrew" },
  { value: "en", labelKey: "language.english" },
];

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      aria-label={t("language.preference")}
      className="theme-panel inline-flex rounded-xl border p-1 text-xs font-bold"
      role="radiogroup"
    >
      {languageOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-checked={language === option.value}
          onClick={() => setLanguage(option.value)}
          role="radio"
          className={`rounded-lg px-3 py-2 transition ${
            language === option.value
              ? "bg-white text-slate-950"
              : "theme-muted hover:bg-green-500/10 hover:text-green-300"
          }`}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
