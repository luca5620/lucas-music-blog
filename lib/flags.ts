/**
 * Feature flags — things that are BUILT but deliberately not on yet.
 *
 * Not env vars: these are product decisions, not per-environment
 * config, and they belong in git where the reason is written down.
 */

/**
 * SoundCloud as a preview player on release pages / Your Taste.
 *
 * OFF since 2026-09-13 (Luca: "let's just put soundcloud on hold and
 * I'll revisit the API status — remove any buttons or mentions of the
 * previews for soundcloud but keep it available in the back").
 *
 * WHY: finding a record's SoundCloud page needs the SoundCloud API,
 * and their API keys now require a paid Artist Pro subscription. With
 * no keys the resolver can never find anything, so the option was a
 * setting that silently did nothing.
 *
 * WHAT IS STILL HERE, untouched and ready: lib/soundcloud.ts (search,
 * link reading, the release-page resolver + its cache),
 * components/releases/SoundCloudEmbed.tsx, the `soundcloud_url` /
 * `soundcloud_checked_at` columns and `catalog_set_soundcloud`
 * (migration 042), the widget host in the CSP, and the copy in all six
 * languages. The DB check on `profiles.preferred_player` still allows
 * 'soundcloud', so anyone who already picked it keeps their row — they
 * just see Spotify while this is off.
 *
 * TO TURN IT BACK ON: set the SOUNDCLOUD_CLIENT_ID / _SECRET env vars
 * and flip this to true. That is the whole job — nothing else to
 * rebuild.
 *
 * NOTE: this flag does NOT touch Aux Wars. Putting a SoundCloud
 * song on in a battle works today with no API key at all, because a
 * pasted link is read through SoundCloud's open oEmbed endpoint.
 */
export const SOUNDCLOUD_PLAYER_ENABLED: boolean = false;

/**
 * The animated app opening (components/ui/SplashCurtain.tsx).
 *
 * OFF since 2026-09-16 (Luca: "there are 2 splash screens that pop up
 * when opening the app and does not look good").
 *
 * WHY TWO SHOWED. Capacitor's native splash is configured
 * `launchShowDuration: 1200, launchAutoHide: true`
 * (capacitor.config.ts). The app's WebView loads the LIVE site over
 * the network, and on a cold boot that takes longer than 1200ms — so
 * the native still appears, auto-hides on its timer while the web
 * layer is still loading, and THEN the web curtain plays its own
 * ~1.6s. The curtain's `hideNativeSplash()` call can't prevent it:
 * by the time React runs, the native splash has already come and
 * gone. Two curtains, one after the other.
 *
 * THE REAL FIX NEEDS A NATIVE REBUILD (hence "until mac rebuild"):
 * set `launchAutoHide: false` in capacitor.config.ts so the native
 * still stays up until the web layer explicitly hides it. Then the
 * hand-off is seamless — native still → web curtain → app, with no
 * gap and no double. That is a capacitor.config change, so it needs
 * `npx cap sync`, Xcode, and a new build submitted; it cannot ship
 * through a Vercel deploy. Flip this flag to true IN THE SAME COMMIT
 * as that config change, never before.
 *
 * MEANWHILE the app shows only the native still, which is the
 * behaviour it had before 2026-09-15 and looks correct.
 *
 * TO PREVIEW THE CURTAIN WITHOUT SHIPPING IT: add `?splash=1` to any
 * URL, in the browser or in the app. It plays once, flag or no flag.
 */
export const APP_SPLASH_CURTAIN_ENABLED: boolean = false;
