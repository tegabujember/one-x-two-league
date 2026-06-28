export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "one-x-two-theme-preference";
export const THEME_CHANGE_EVENT = "one-x-two-theme-change";
export const DARK_THEME_COLOR = "#020617";
export const LIGHT_THEME_COLOR = "#f8fafc";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isThemePreference(storedPreference) ? storedPreference : "dark";
  } catch {
    return "dark";
  }
}

export function setStoredThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function getLightModeMediaQuery() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return null;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: light)");
  } catch {
    return null;
  }
}

export function resolveThemePreference(
  preference: ThemePreference
): ResolvedTheme {
  if (preference === "system") {
    return getLightModeMediaQuery()?.matches ? "light" : "dark";
  }

  return preference === "light" ? "light" : "dark";
}

export function updateThemeColor(resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  let themeColorMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );

  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.content =
    resolvedTheme === "light" ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
}

export function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  updateThemeColor(resolvedTheme);
}

export function getThemeInitScript() {
  return `
(function () {
  var storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  var darkThemeColor = ${JSON.stringify(DARK_THEME_COLOR)};
  var lightThemeColor = ${JSON.stringify(LIGHT_THEME_COLOR)};

  function isPreference(value) {
    return value === "dark" || value === "light" || value === "system";
  }

  function getPreference() {
    try {
      var storedPreference = window.localStorage.getItem(storageKey);
      return isPreference(storedPreference) ? storedPreference : "dark";
    } catch (error) {
      return "dark";
    }
  }

  function resolvePreference(preference) {
    if (preference === "system") {
      try {
        return window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
      } catch (error) {
        return "dark";
      }
    }

    return preference === "light" ? "light" : "dark";
  }

  function updateThemeColor(resolvedTheme) {
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.content =
      resolvedTheme === "light" ? lightThemeColor : darkThemeColor;
  }

  var resolvedTheme = resolvePreference(getPreference());

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  updateThemeColor(resolvedTheme);
})();
`;
}
