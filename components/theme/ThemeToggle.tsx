"use client";

import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "./theme";

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      aria-label="Theme preference"
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
          {option.label}
        </button>
      ))}
    </div>
  );
}
