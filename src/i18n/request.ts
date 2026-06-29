import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

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

export default getRequestConfig(async ({ requestLocale }) => {
  const requestHeaders = await headers();
  const requestCookies = await cookies();

  const locale =
    resolveSupportedLocale(requestHeaders.get("x-locale")) ??
    resolveSupportedLocale(await requestLocale) ??
    resolveSupportedLocale(requestCookies.get("locale")?.value) ??
    resolveSupportedLocale(requestHeaders.get("accept-language")?.split(",")[0]) ??
    "en";

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
