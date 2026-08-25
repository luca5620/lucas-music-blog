/**
 * Cover-art sizing helpers.
 *
 * Spotify serves every cover at three fixed sizes, addressed by a
 * prefix in the image id — same hash, different bytes:
 *   ab67616d0000b273… → 640×640  (what the catalog stores)
 *   ab67616d00001e02… → 300×300
 *   ab67616d00004851… → 64×64
 *
 * Feed grids and poster walls render covers at ~150–300 CSS px, so
 * shipping the 640px file is ~4× the bytes for zero visible gain —
 * on the audited homepage that was ~2.4MB of a 3.8MB page. Swap in
 * the 300px variant for small contexts; keep 640 for the release
 * page hero where the cover really is big.
 *
 * Non-Spotify URLs (Genius, manual) pass through untouched.
 */

/** 300×300 variant of a Spotify cover URL; anything else unchanged. */
export function smallCover(url: string): string;
export function smallCover(url: string | null): string | null;
export function smallCover(url: string | null): string | null {
  if (!url) return url;
  return url.replace("ab67616d0000b273", "ab67616d00001e02");
}

/** 64×64 variant for thumbnail-sized slots (compact rows, chips). */
export function thumbCover(url: string): string;
export function thumbCover(url: string | null): string | null;
export function thumbCover(url: string | null): string | null {
  if (!url) return url;
  return url.replace("ab67616d0000b273", "ab67616d00004851");
}
