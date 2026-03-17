import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from './locales/en.json';
import esLocale from './locales/es.json';
import frLocale from './locales/fr.json';

export const defaultNS = 'translation';

i18n
  .use(initReactI18next)
  .init({
    // Default language
    lng: typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en',
    fallbackLng: 'en',

    // Namespace and resources
    defaultNS,
    resources: {
      en: { [defaultNS]: enLocale },
      es: { [defaultNS]: esLocale },
      fr: { [defaultNS]: frLocale },
    },

    interpolation: {
      // React already escapes by default
      escapeValue: false,
    },

    // Don't log missing keys in production
    saveMissing: false,
  });

export default i18n;
