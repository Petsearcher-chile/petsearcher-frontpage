import { cookies, headers } from "next/headers";

import enMessages from "@/messages/en.json";

const AVAILABLE_LOCALES = ["en", "es", "pt"] as const;
type AvailableLocale = (typeof AVAILABLE_LOCALES)[number];

const normalizeLocale = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase().replaceAll("_", "-").split("-")[0] ?? null;
};

const loadMessages = async (locale: AvailableLocale) => {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default as typeof enMessages;
  } catch {
    return enMessages;
  }
};

const resolveLocale = async () => {
  const requestCookies = await cookies();
  const requestHeaders = await headers();

  const cookieLocale = normalizeLocale(requestCookies.get("locale")?.value);
  if (cookieLocale && AVAILABLE_LOCALES.includes(cookieLocale as AvailableLocale)) {
    return cookieLocale as AvailableLocale;
  }

  const acceptLanguage = requestHeaders.get("accept-language");
  const headerLocale = normalizeLocale(acceptLanguage?.split(",")[0] ?? null);
  if (headerLocale && AVAILABLE_LOCALES.includes(headerLocale as AvailableLocale)) {
    return headerLocale as AvailableLocale;
  }

  return "en";
};

export const getIntl = async () => {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
  };
};
