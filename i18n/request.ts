import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, pickLocale, type Locale } from "./config";

/**
 * next-intl's per-request setup (wired in next.config.ts via
 * createNextIntlPlugin). Runs once per server render and decides
 * which language this response speaks — see i18n/config.ts for the
 * design. Cookie first, then the browser's own preference, then
 * English. The dictionary is a plain JSON import so only the chosen
 * language ships to the client.
 */
export default getRequestConfig(async () => {
  let locale: Locale = DEFAULT_LOCALE;

  const store = await cookies();
  const chosen = store.get(LANG_COOKIE)?.value;
  if (isLocale(chosen)) {
    locale = chosen;
  } else {
    const accept = (await headers()).get("accept-language");
    locale = pickLocale(accept);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
