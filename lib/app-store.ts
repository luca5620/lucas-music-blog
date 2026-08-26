/**
 * App Store state — shared by every page that mentions the iOS app.
 *
 * Extracted 2026-08-25 when /letterboxd-for-music became the third
 * place needing the listing URL (home badge + /musicboard-alternative
 * already had their own copies). One module = the auto-flip logic and
 * the Apple ID live in exactly one place.
 */

/* Apple ID 6803279876, provided by Luca 2026-08-24. The listing goes
   live at this URL the moment Apple approves the app. */
export const APP_STORE_ID = "6803279876";
export const APP_STORE_URL = `https://apps.apple.com/us/app/peak-music-reviews/id${APP_STORE_ID}`;

/**
 * Is the iOS app actually live on the App Store yet? Apple's public
 * lookup API returns resultCount 0 until the listing exists, so pages
 * never have to claim an app that isn't there — and flip to "on the
 * App Store" automatically the day approval lands (result cached for
 * an hour; on any error we assume not-live, the safe claim). No
 * hand-edit, no redeploy.
 */
export async function isAppStoreLive(): Promise<boolean> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=us`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { resultCount?: number };
    return (data.resultCount ?? 0) > 0;
  } catch {
    return false;
  }
}
