/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('aether_lang');
    const lang = (saved as Language) || 'en';
    console.log('[LanguageContext] Initializing with language:', lang);
    return lang;
  });

  const setLanguage = (lang: Language) => {
    console.log('[LanguageContext] Setting language to:', lang);
    setLanguageState(lang);
    localStorage.setItem('aether_lang', lang);
  };

  const t = (key: TranslationKey): string => {
    const translation = translations[language]?.[key] || translations['en'][key] || key;
    if (!translations[language]?.[key] && !translations['en'][key]) {
      console.warn('[LanguageContext] Missing translation key:', key);
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
