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
  applyLanguage,
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  interpolateTranslation,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_DIRECTIONS,
  LANGUAGE_LOCALES,
  setStoredLanguage,
} from "@/lib/i18n/config";
import type {
  Direction,
  Language,
  TranslationParams,
} from "@/lib/i18n/config";
import { he } from "@/lib/i18n/dictionaries/he";
import type { TranslationKey } from "@/lib/i18n/dictionaries/he";
import { en } from "@/lib/i18n/dictionaries/en";

type LanguageContextValue = {
  language: Language;
  locale: string;
  dir: Direction;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const dictionaries = { he, en } as Record<
  Language,
  Record<TranslationKey, string>
>;

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  locale: LANGUAGE_LOCALES[DEFAULT_LANGUAGE],
  dir: LANGUAGE_DIRECTIONS[DEFAULT_LANGUAGE],
  setLanguage: () => {},
  t: (key, params) => interpolateTranslation(he[key], params),
});

function subscribeToLanguageChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

export function LanguageProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const getServerSnapshot = useCallback(
    () => initialLanguage,
    [initialLanguage]
  );
  const language = useSyncExternalStore(
    subscribeToLanguageChanges,
    getStoredLanguage,
    getServerSnapshot
  );

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setStoredLanguage(nextLanguage);
    applyLanguage(nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      interpolateTranslation(dictionaries[language][key], params),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      locale: LANGUAGE_LOCALES[language],
      dir: LANGUAGE_DIRECTIONS[language],
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
