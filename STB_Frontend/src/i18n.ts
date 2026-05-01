import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/common.json";
import nl from "./locales/nl/common.json";

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
      }
    },

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;