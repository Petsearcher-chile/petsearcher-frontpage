import enMessages from "@/messages/en.json";

import { getIntl } from "./get-intl";

type TranslationParams = Record<string, string | number>;

type ApiMessages = Record<string, string>;

const interpolate = (template: string, params?: TranslationParams) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params?.[key];
    return value === undefined ? `{${key}}` : String(value);
  });

export const getApiTranslator = async () => {
  const { messages } = await getIntl();
  const currentApi = (messages as { Api?: ApiMessages }).Api ?? {};
  const fallbackApi = (enMessages as { Api?: ApiMessages }).Api ?? {};

  return (key: string, params?: TranslationParams) =>
    interpolate(currentApi[key] ?? fallbackApi[key] ?? key, params);
};
