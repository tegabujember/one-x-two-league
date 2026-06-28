"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  applyResolvedTheme,
  getLightModeMediaQuery,
  getStoredThemePreference,
  resolveThemePreference,
  setStoredThemePreference,
  THEME_CHANGE_EVENT,
} from "./theme";
import type { ResolvedTheme, ThemePreference } from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "dark",
  resolvedTheme: "dark",
  setPreference: () => {},
});

function getThemeSnapshot() {
  const preference = getStoredThemePreference();
  const resolvedTheme = resolveThemePreference(preference);

  return `${preference}:${resolvedTheme}`;
}

function getServerThemeSnapshot() {
  return "dark:dark";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeSnapshot = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    getServerThemeSnapshot
  );
  const [preference, resolvedTheme] = themeSnapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      setStoredThemePreference(nextPreference);
      applyResolvedTheme(resolveThemePreference(nextPreference));
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    },
    []
  );

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const mediaQuery = getLightModeMediaQuery();

    if (!mediaQuery) {
      return;
    }

    const handleSystemThemeChange = () => {
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [preference]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, resolvedTheme, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
