import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TRANSLATIONS, type Language, type TranslationKey } from './translations';

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggle: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'adinf_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'es';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'es' ? stored : 'es';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore (private mode, etc.)
    }
  }, [lang]);

  const setLang = useCallback((l: Language) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((p) => (p === 'es' ? 'en' : 'es')), []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const entry = TRANSLATIONS[key];
      if (!entry) return String(key);
      return entry[lang] ?? entry.es ?? String(key);
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

/** Shorthand hook that returns just the translator function. */
export function useT() {
  return useLanguage().t;
}
