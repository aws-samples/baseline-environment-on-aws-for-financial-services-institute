import i18next from 'i18next';
import detector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ja from './ja.json';

export const LANGUAGES = [
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'ja',
    label: '日本語',
  },
];

const resources = {
  en: {
    translation: en,
  },
  ja: {
    translation: ja,
  },
};

// Settings i18n
const i18n = i18next
  .use(initReactI18next)
  .use(detector)
  .init({
    resources,
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });

export default i18n;
