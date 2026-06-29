export const AVAILABLE_LOCALES = [
  "en",
  "es",
  "en-gb",
  "pt",
  "fr",
  "de",
  "it",
  "nl",
  "sv",
  "no",
  "da",
  "fi",
  "is",
  "pl",
  "cs",
  "sk",
  "sl",
  "hr",
  "sr",
  "bs",
  "ro",
  "bg",
  "ru",
  "uk",
  "be",
  "el",
  "tr",
  "he",
  "ar",
  "fa",
  "ur",
  "hi",
  "bn",
  "pa",
  "ta",
  "te",
  "ml",
  "mr",
  "gu",
  "kn",
  "th",
  "vi",
  "id",
  "ms",
  "fil",
  "ja",
  "ko",
  "zh",
  "yue",
  "km",
  "lo",
  "my",
  "sw",
  "am",
  "zu",
  "af",
  "xh",
  "eo",
] as const;

export type AvailableLocale = (typeof AVAILABLE_LOCALES)[number];

export const normalizeLocaleCandidate = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return normalized || null;
};

export const resolveSupportedLocale = (value: string | undefined | null): AvailableLocale | null => {
  const normalized = normalizeLocaleCandidate(value);
  if (!normalized) {
    return null;
  }

  const exactMatch = AVAILABLE_LOCALES.find((locale) => locale === normalized);
  if (exactMatch) {
    return exactMatch;
  }

  const baseLanguage = normalized.split("-")[0];
  return AVAILABLE_LOCALES.find((locale) => locale === baseLanguage) ?? null;
};

export const formatHreflangLocale = (locale: AvailableLocale) => {
  const parts = locale.split("-");
  if (parts.length === 1) {
    return locale;
  }

  return `${parts[0]}-${parts[1].toUpperCase()}`;
};

export const formatOpenGraphLocale = (locale: AvailableLocale) => {
  const parts = locale.split("-");
  if (parts.length === 1) {
    return locale === "en" ? "en_US" : `${locale}_XX`;
  }

  return `${parts[0]}_${parts[1].toUpperCase()}`;
};
