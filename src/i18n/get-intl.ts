import { cookies, headers } from "next/headers";

import enMessages from "@/messages/en.json";
import { resolveSupportedLocale, type AvailableLocale } from "./locales";

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

  const requestedLocale = resolveSupportedLocale(requestHeaders.get("x-locale"));
  if (requestedLocale) {
    return requestedLocale;
  }

  const cookieLocale = resolveSupportedLocale(requestCookies.get("locale")?.value);
  if (cookieLocale) {
    return cookieLocale;
  }

  const acceptLanguage = requestHeaders.get("accept-language");
  const headerLocale = resolveSupportedLocale(acceptLanguage?.split(",")[0] ?? null);
  if (headerLocale) {
    return headerLocale;
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
