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
