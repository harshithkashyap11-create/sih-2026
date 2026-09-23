import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import as from "./as.json";
import bn from "./bn.json";
import en from "./en.json";
import hi from "./hi.json";
import te from "./te.json";

export const i18n = i18next.createInstance();

export const supportedLanguages = ["en", "as", "bn", "hi", "te", "mni", "lus", "brx", "kha", "grt", "ne", "trp"] as const;
export const languageNames = { en: "English", as: "অসমীয়া", bn: "বাংলা", hi: "हिन्दी", te: "తెలుగు", mni: "ꯃꯤꯇꯩꯂꯣꯟ (Manipuri)", lus: "Mizo", brx: "बड़ो (Bodo)", kha: "Khasi", grt: "Garo", ne: "नेपाली", trp: "Kokborok" };
export type SupportedLanguage = (typeof supportedLanguages)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    as: { translation: as },
    bn: { translation: bn },
    hi: { translation: hi },
    te: { translation: te },
    ...Object.fromEntries(["mni", "lus", "brx", "kha", "grt", "ne", "trp"].map((language) => [language, { translation: {} }])),
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: [...supportedLanguages],
  load: "languageOnly",
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  initImmediate: false,
});
