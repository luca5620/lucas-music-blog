import { getRequestConfig } from "next-intl/server";
import { requestLocale } from "./resolve";

/**
 * next-intl's per-request setup (wired in next.config.ts via
 * createNextIntlPlugin). Runs once per server render and decides
 * which language this response speaks — see i18n/config.ts for the
 * design. Cookie first, then the browser's own preference, then
 * English (the lookup itself lives in i18n/resolve.ts, shared with
 * the push-token route). The dictionary is a plain JSON import so
 * only the chosen language ships to the client.
 */
export default getRequestConfig(async () => {
  const locale = await requestLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
