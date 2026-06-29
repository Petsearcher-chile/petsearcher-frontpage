import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

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

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = normalizeLocale(await requestLocale);
  const cookieLocale = normalizeLocale((await cookies()).get("locale")?.value);
  const headerLocale = normalizeLocale((await headers()).get("accept-language")?.split(",")[0]);

  const locale =
    [requestedLocale, cookieLocale, headerLocale].find(
      (candidate): candidate is AvailableLocale =>
        Boolean(candidate) && AVAILABLE_LOCALES.includes(candidate as AvailableLocale),
    ) ?? "en";

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
