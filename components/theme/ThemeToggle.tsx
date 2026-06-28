"use client";

import { useTheme } from "./ThemeProvider";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ThemePreference } from "./theme";

const themeOptions: Array<{
  value: ThemePreference;
  labelKey: "theme.dark" | "theme.light" | "theme.system";
}> = [
  { value: "dark", labelKey: "theme.dark" },
  { value: "light", labelKey: "theme.light" },
  { value: "system", labelKey: "theme.system" },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      aria-label={t("theme.preference")}
      className="theme-panel inline-flex rounded-xl border p-1 text-xs font-bold"
      role="radiogroup"
    >
      {themeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-checked={preference === option.value}
          onClick={() => setPreference(option.value)}
          role="radio"
          className={`rounded-lg px-3 py-2 transition ${
            preference === option.value
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
