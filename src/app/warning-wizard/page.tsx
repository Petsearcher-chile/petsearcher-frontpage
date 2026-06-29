"use client";

import Lottie from "lottie-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import wizardAnimation from "@/assets/Hi Wizard.json";

type LanguageOption = {
  value: string;
  label: string;
  flag: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "en-gb", label: "English (UK)", flag: "🇬🇧" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "nl", label: "Nederlands", flag: "🇳🇱" },
  { value: "sv", label: "Svenska", flag: "🇸🇪" },
  { value: "no", label: "Norsk", flag: "🇳🇴" },
  { value: "da", label: "Dansk", flag: "🇩🇰" },
  { value: "fi", label: "Suomi", flag: "🇫🇮" },
  { value: "is", label: "Íslenska", flag: "🇮🇸" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "cs", label: "Čeština", flag: "🇨🇿" },
  { value: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { value: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { value: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { value: "sr", label: "Srpski", flag: "🇷🇸" },
  { value: "bs", label: "Bosanski", flag: "🇧🇦" },
  { value: "ro", label: "Română", flag: "🇷🇴" },
  { value: "bg", label: "Български", flag: "🇧🇬" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "uk", label: "Українська", flag: "🇺🇦" },
  { value: "be", label: "Беларуская", flag: "🇧🇾" },
  { value: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
  { value: "he", label: "עברית", flag: "🇮🇱" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "fa", label: "فارسی", flag: "🇮🇷" },
  { value: "ur", label: "اردو", flag: "🇵🇰" },
  { value: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { value: "bn", label: "বাংলা", flag: "🇧🇩" },
  { value: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { value: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { value: "te", label: "తెలుగు", flag: "🇮🇳" },
  { value: "ml", label: "മലയാളം", flag: "🇮🇳" },
  { value: "mr", label: "मराठी", flag: "🇮🇳" },
  { value: "gu", label: "ગુજરાતી", flag: "🇮🇳" },
  { value: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { value: "th", label: "ไทย", flag: "🇹🇭" },
  { value: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { value: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { value: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { value: "fil", label: "Filipino", flag: "🇵🇭" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "yue", label: "粵語", flag: "🇭🇰" },
  { value: "km", label: "ខ្មែរ", flag: "🇰🇭" },
  { value: "lo", label: "ລາວ", flag: "🇱🇦" },
  { value: "my", label: "မြန်မာဘာသာ", flag: "🇲🇲" },
  { value: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { value: "am", label: "አማርኛ", flag: "🇪🇹" },
  { value: "zu", label: "isiZulu", flag: "🇿🇦" },
  { value: "af", label: "Afrikaans", flag: "🇿🇦" },
  { value: "xh", label: "isiXhosa", flag: "🇿🇦" },
  { value: "eo", label: "Esperanto", flag: "🏳️" },
] as const;

const normalizeLanguageValue = (value: string | null) =>
  value ? value.toLowerCase().replaceAll("_", "-").split("-")[0] ?? value.toLowerCase() : "";

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const getBrowserLanguageOption = () => {
  if (typeof navigator === "undefined") {
    return LANGUAGE_OPTIONS[0];
  }

  const browserLanguages = [navigator.language, ...navigator.languages].filter(
    (language): language is string => Boolean(language),
  );

  for (const browserLanguage of browserLanguages) {
    const normalizedBrowserLanguage = normalizeLanguageValue(browserLanguage);
    const exactMatch = LANGUAGE_OPTIONS.find(
      (option) =>
        option.value === browserLanguage.toLowerCase() ||
        option.value === normalizedBrowserLanguage,
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  const browserPrimaryLanguage = normalizeLanguageValue(browserLanguages[0] ?? "");
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === browserPrimaryLanguage) ??
    LANGUAGE_OPTIONS[0]
  );
};

const getPreferredLanguageOption = () => {
  const cookieLocale = normalizeLanguageValue(getCookieValue("locale"));
  if (cookieLocale) {
    const cookieLanguage = LANGUAGE_OPTIONS.find((option) => option.value === cookieLocale);
    if (cookieLanguage) {
      return cookieLanguage;
    }
  }

  return getBrowserLanguageOption();
};

export default function WarningWizardPage() {
  const t = useTranslations("WarningWizard");
  const tCommon = useTranslations("Common");
  const initialBrowserLanguage = getPreferredLanguageOption();
  const speechSteps = useMemo(
    () =>
      [
        { text: t("hello"), delayMs: 1600 },
        { text: t("first_time_here"), delayMs: 4000 },
        { text: t("site_only_computer"), delayMs: 6000 },
        { text: t("see_you_there"), delayMs: 4000 },
      ] as const,
    [t],
  );
  const [speechIndex, setSpeechIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(initialBrowserLanguage.value);
  const [languageQuery, setLanguageQuery] = useState("");
  const [isLanguageSearching, setIsLanguageSearching] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  const filteredLanguageOptions = LANGUAGE_OPTIONS.filter((language) => {
    const search = languageQuery.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return (
      language.label.toLowerCase().includes(search) ||
      language.value.toLowerCase().includes(search) ||
      language.flag.includes(search)
    );
  });

  const selectedLanguageOption =
    LANGUAGE_OPTIONS.find((language) => language.value === selectedLanguage) ??
    initialBrowserLanguage;
  const languageInputValue = isLanguageSearching
    ? languageQuery
    : `${selectedLanguageOption.flag} ${selectedLanguageOption.label}`;

  useEffect(() => {
    const timeoutIds: number[] = [];
    let isCancelled = false;
    let currentIndex = 0;

    const scheduleStep = (stepIndex: number) => {
      const step = speechSteps[stepIndex];
      const timeoutId = window.setTimeout(() => {
        if (isCancelled) {
          return;
        }

        if (stepIndex < speechSteps.length - 1) {
          currentIndex += 1;
          setSpeechIndex(currentIndex);
          scheduleStep(currentIndex);
          return;
        }

        setIsSpeaking(false);
      }, step.delayMs);

      timeoutIds.push(timeoutId);
    };

    scheduleStep(0);

    return () => {
      isCancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [speechSteps]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="fixed right-4 top-4 z-30">
        <div className="relative flex items-center gap-2">
          <label htmlFor="wizard-language-search" className="sr-only">
            {tCommon("search_language")}
          </label>
          <input
            id="wizard-language-search"
            type="text"
            value={languageInputValue}
            onFocus={() => {
              setIsLanguageSearching(true);
              setLanguageQuery("");
              setIsLanguageMenuOpen(true);
            }}
            onChange={(event) => {
              setLanguageQuery(event.target.value);
              setIsLanguageMenuOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setIsLanguageMenuOpen(false);
                if (!languageQuery.trim()) {
                  setIsLanguageSearching(false);
                }
              }, 120);
            }}
            placeholder={tCommon("search_language")}
            className="h-9 w-48 rounded-full border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 outline-none transition placeholder:text-zinc-400 hover:bg-zinc-100 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:hover:bg-zinc-800 dark:focus:border-zinc-500"
          />
          {isLanguageMenuOpen ? (
            <div className="absolute bottom-full right-0 z-40 mb-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
              <div className="max-h-72 overflow-auto p-2">
                {filteredLanguageOptions.length > 0 ? (
                  filteredLanguageOptions.map((language) => (
                    <button
                      key={language.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                        selectedLanguage === language.value
                          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                          : "text-zinc-700 dark:text-zinc-200"
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSelectedLanguage(language.value);
                        setLanguageQuery("");
                        setIsLanguageSearching(false);
                        setIsLanguageMenuOpen(false);
                        document.cookie = `locale=${encodeURIComponent(language.value)}; path=/; max-age=31536000`;
                        window.location.reload();
                      }}
                    >
                      <span className="text-base">{language.flag}</span>
                      <span className="truncate">{language.label}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {tCommon("no_results")}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <section className="flex w-full max-w-4xl flex-col items-center justify-center gap-6">
        <div
          className={`relative rounded-3xl border border-white/10 bg-white/8 px-6 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-sm transition-all duration-700 ${
            isSpeaking ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
          }`}
          aria-live="polite"
        >
          <p className="max-w-[28rem] whitespace-pre-line text-lg font-medium leading-relaxed text-zinc-100 sm:text-xl">
            {speechSteps[speechIndex].text}
          </p>
          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-10 border-t-10 border-x-transparent border-t-white/8" />
        </div>

        <div className="h-[60vh] w-[min(85vw,60vh)]">
          <Lottie animationData={wizardAnimation} loop />
        </div>
      </section>
    </main>
  );
}
