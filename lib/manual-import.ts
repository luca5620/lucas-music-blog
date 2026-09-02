/**
 * Manual release import — the by-hand door for records that neither
 * Spotify nor Genius carries (Luca 2026-09-02).
 *
 * The write-a-review page tells people to email contact@ when their
 * release isn't searchable; staff then type it in through the admin
 * import tool's Manual tab, which lands here. Nothing about this path
 * is open to regular users — the API route gates on role + the
 * emailed sign-in code before calling in.
 *
 * Shape of the result: a normal `releases` row with
 *   source = 'manual', spotify_id = null, genius_id = null
 * so every downstream feature (reviews, lists, release page, feeds)
 * treats it exactly like an imported one. The release page simply
 * shows no Spotify preview (SpotifyEmbed returns null without a
 * spotify_id) — the tracklist card takes its place.
 *
 * Artist resolution, in order:
 *   1. an explicit artist_id (staff picked an existing artist)
 *   2. an exact case-insensitive name match on the artists table
 *      (so "Frank Ocean" lands on the real Frank Ocean row, not a
 *      duplicate)
 *   3. a brand-new artist row (spotify_id null, slug from the name)
 */

import { slugify } from "@/lib/spotify-import";
import {
  getArtistById,
  getArtistBySlug,
  searchArtists,
  upsertArtist,
} from "@/lib/db/artists";
import {
  attachReleaseArtists,
  getReleaseBySlug,
  upsertRelease,
} from "@/lib/db/releases";
import type { Artist, Release, ReleaseTrack } from "@/lib/types/database";

export const RELEASE_TYPES: Release["release_type"][] = [
  "album",
  "EP",
  "single",
  "mixtape",
  "compilation",
];

export interface ManualImportInput {
  title: string;
  /** Existing artist uuid — wins over artist_name when both are sent. */
  artist_id?: string | null;
  artist_name?: string | null;
  release_type: Release["release_type"];
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  release_date: string | null;
  /** https cover URL or null. */
  cover_image: string | null;
  /** One title per entry, already trimmed; empty = no tracklist. */
  tracks: string[];
  is_unreleased: boolean;
  description: string | null;
}

/** Find a unique slug: base, then base-2, base-3, … (staff imports
    are rare, so a tiny linear probe is fine). */
async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let n = 2; n <= 50; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Could not find a free slug for "${base}"`);
}

async function resolveArtist(input: ManualImportInput): Promise<Artist> {
  if (input.artist_id) {
    const found = await getArtistById(input.artist_id);
    if (!found) throw new Error("That artist id doesn't exist.");
    return found;
  }

  const name = (input.artist_name ?? "").trim();
  if (!name) throw new Error("Artist name is required.");

  // Exact (case-insensitive) match on an existing row beats creating
  // a lookalike — searchArtists is a contains-match, so filter it.
  const candidates = await searchArtists(name, 10);
  const exact = candidates.find(
    (a) => a.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (exact) return exact;

  const base = slugify(name) || "artist";
  const slug = await uniqueSlug(base, async (s) => !!(await getArtistBySlug(s)));

  return upsertArtist({
    slug,
    name,
    spotify_id: null,
    genius_id: null,
    image_url: null,
    bio: null,
    genres: [],
    popularity: null,
  });
}

export async function importReleaseManually(
  input: ManualImportInput
): Promise<Release> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  if (title.length > 200) throw new Error("Title is too long (200 max).");
  if (!RELEASE_TYPES.includes(input.release_type)) {
    throw new Error("Pick a valid release type.");
  }
  if (input.release_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.release_date)) {
    throw new Error("Release date must be YYYY-MM-DD.");
  }
  if (input.cover_image && !/^https:\/\/\S+$/i.test(input.cover_image)) {
    throw new Error("Cover image must be an https:// URL.");
  }
  if (input.tracks.length > 100) {
    throw new Error("Tracklist is capped at 100 entries.");
  }

  const artist = await resolveArtist(input);

  // Same slug recipe as the Spotify importer: "{title}-{artist}".
  const base = slugify(`${title}-${artist.name}`) || "release";
  const slug = await uniqueSlug(base, async (s) => !!(await getReleaseBySlug(s)));

  const tracks: ReleaseTrack[] = input.tracks
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({
      position: i + 1,
      title: t.slice(0, 200),
      duration_ms: 0,
      spotify_id: undefined,
      preview_url: null,
    }));

  const release = await upsertRelease({
    slug,
    title,
    primary_artist_id: artist.id,
    release_type: input.release_type,
    release_date: input.release_date || null,
    cover_image: input.cover_image || null,
    spotify_id: null,
    genius_id: null,
    source: "manual",
    is_unreleased: input.is_unreleased,
    description: input.description?.trim() || null,
    tracks,
    popularity: null,
  });

  await attachReleaseArtists(release.id, [
    { artistId: artist.id, role: "primary", position: 0 },
  ]);

  return release;
}
