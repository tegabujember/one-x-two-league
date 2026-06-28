export type Language = "he" | "en";
export type Direction = "rtl" | "ltr";

export const DEFAULT_LANGUAGE: Language = "he";
export const LANGUAGE_STORAGE_KEY = "one-x-two-language-preference";
export const LANGUAGE_CHANGE_EVENT = "one-x-two-language-change";

export const LANGUAGE_LOCALES: Record<Language, string> = {
  he: "he-IL",
  en: "en-US",
};

export const LANGUAGE_DIRECTIONS: Record<Language, Direction> = {
  he: "rtl",
  en: "ltr",
};

export type TranslationParams = Record<string, string | number>;

export function isLanguage(value: unknown): value is Language {
  return value === "he" || value === "en";
}

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setStoredLanguage(language: Language) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }

  document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function applyLanguage(language: Language) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = language;
  document.documentElement.dir = LANGUAGE_DIRECTIONS[language];
  document.documentElement.dataset.language = language;
}

export function interpolateTranslation(
  value: string,
  params?: TranslationParams
) {
  if (!params) {
    return value;
  }

  return value.replace(/\{(\w+)\}/g, (match, key: string) => {
    const replacement = params[key];
    return replacement === undefined ? match : String(replacement);
  });
}

export function getLanguageInitScript() {
  return `
(function () {
  var storageKey = ${JSON.stringify(LANGUAGE_STORAGE_KEY)};
  var language = ${JSON.stringify(DEFAULT_LANGUAGE)};

  try {
    var storedLanguage = window.localStorage.getItem(storageKey);
    if (storedLanguage === "he" || storedLanguage === "en") {
      language = storedLanguage;
    }
  } catch (error) {}

  document.documentElement.lang = language;
  document.documentElement.dir = language === "en" ? "ltr" : "rtl";
  document.documentElement.dataset.language = language;
  document.cookie = storageKey + "=" + language + "; Path=/; Max-Age=31536000; SameSite=Lax";
})();
`;
}
