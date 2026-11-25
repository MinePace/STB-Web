import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/common.json";
import nl from "./locales/nl/common.json";
import de from "./locales/de/common.json";
import tr from "./locales/tr/common.json";
import es from "./locales/es/common.json";

const savedLanguage = localStorage.getItem("language") || "en";

i18n
  .use(initReactI18next)
  .init({
    lng: savedLanguage,
    fallbackLng: "en",

    resources: {
      en: {
        translation: en
      },
      nl: {
        translation: nl
      },
      de: {
        translation: de
      },
      tr: {
        translation: tr
      },
      es: {
        translation: es
      }
    },

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;