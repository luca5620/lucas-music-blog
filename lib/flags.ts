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
 * ON since 2026-09-21, gated by SPLASH_HANDOFF_MIN_BUILD below — read
 * that comment for what the gate protects.
 *
 * THE HISTORY, because it explains the shape. Turned OFF 2026-09-16
 * (Luca: "there are 2 splash screens that pop up when opening the app
 * and does not look good"). The native splash shipped in builds 1–2
 * with `launchAutoHide: true` on a 1200ms timer; the WebView loads
 * the LIVE site over the network, and on a cold boot that takes
 * longer than 1200ms — so the native still came and went BEFORE React
 * could call hideNativeSplash(), and then the web curtain played its
 * own ~1.6s. Two curtains, one after the other.
 *
 * THE FIX IS IN THE BINARY: build 3 ships `launchAutoHide: false`
 * (capacitor.config.ts), so the native still HOLDS until the web layer
 * dismisses it and the hand-off is one continuous opening. That came
 * with an obligation the old code didn't have — with auto-hide off,
 * any path that neither plays the curtain nor hides the still leaves
 * the phone stuck on the launch image. Three things cover it:
 *   1. SplashCurtain is one decision with one exit: play, or hide now
 *      (flag off, reduced motion, old build, already played).
 *   2. NATIVE_SPLASH_FAILSAFE_SCRIPT in <head> hides it after 5s if
 *      React never mounts at all.
 *   3. mobile/www/index.html (the offline NO SIGNAL page) hides it on
 *      load, since it IS the web layer when the site is unreachable.
 *
 * WHY THE FLAG CAN BE TRUE WHILE BUILD 2 IS STILL INSTALLED: the
 * curtain also checks the shell's build number and never plays below
 * SPLASH_HANDOFF_MIN_BUILD. Old installs keep behaving exactly as they
 * did (native still auto-hides, no curtain). Nothing changes for
 * anyone until they update to build 3.
 *
 * TO PREVIEW THE CURTAIN ANYWHERE: add `?splash=1` to any URL, in the
 * browser or in the app. It plays once, flag, gate or no.
 */
export const APP_SPLASH_CURTAIN_ENABLED: boolean = true;

/**
 * The FIRST build whose native still waits for the web layer
 * (launchAutoHide: false — capacitor.config.ts, build 3, 2026-09-21).
 *
 * This is what makes it safe to have the flag above ON for the live
 * site while older binaries are still installed. Whether the launch
 * image auto-hides is baked into each binary, and the web can only
 * find out by asking the shell its build number. So SplashCurtain
 * plays only on builds at or after this one:
 *
 *   build < 3  — native still auto-hides on its own timer, exactly as
 *                it always has; the curtain never plays, so nothing
 *                about those installs changes. (Playing it there IS
 *                the double splash.)
 *   build ≥ 3  — native still holds; the curtain hides it the frame
 *                it appears. One continuous opening.
 *
 * Bump this in the same commit as any future config change that
 * alters what the native splash does.
 */
export const SPLASH_HANDOFF_MIN_BUILD = 3;
