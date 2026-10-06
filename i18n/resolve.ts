import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLocale, pickLocale, type Locale } from "./config";

/**
 * Which language THIS request speaks — server-only (reads the request's
 * cookies + headers). Cookie first, then the browser's own preference,
 * then English; the design is in i18n/config.ts.
 *
 * Shared by i18n/request.ts (which dictionary to render with) and
 * /api/push/register (which language a device's push notifications
 * should arrive in), so a phone's pushes always match the language its
 * app shows.
 */
export async function requestLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LANG_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const accept = (await headers()).get("accept-language");
  return pickLocale(accept); // falls back to English itself
}
