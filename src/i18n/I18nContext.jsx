import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' }
];

function getInitialLanguage() {
  const saved = localStorage.getItem('synapse_language');
  if (saved && (saved === 'pt' || saved === 'en' || saved === 'es')) {
    return saved;
  }
  const browserLang = (typeof navigator !== 'undefined' ? navigator.language || '' : '').toLowerCase();
  if (browserLang.startsWith('en')) return 'en';
  if (browserLang.startsWith('es')) return 'es';
  return 'pt';
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    if (lang === 'pt' || lang === 'en' || lang === 'es') {
      setLanguageState(lang);
      localStorage.setItem('synapse_language', lang);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback((path, params = {}) => {
    const keys = path.split('.');
    let val = translations[language];
    for (const key of keys) {
      if (val && typeof val === 'object' && key in val) {
        val = val[key];
      } else {
        val = undefined;
        break;
      }
    }

    // Fallback to Portuguese or path if missing
    if (typeof val !== 'string') {
      let fallback = translations.pt;
      for (const key of keys) {
        if (fallback && typeof fallback === 'object' && key in fallback) {
          fallback = fallback[key];
        } else {
          fallback = undefined;
          break;
        }
      }
      val = typeof fallback === 'string' ? fallback : path;
    }

    // Replace {params}
    if (typeof val === 'string' && params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        val = val.replaceAll(`{${k}}`, String(v));
      }
    }

    return val;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
