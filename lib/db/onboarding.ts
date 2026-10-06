import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import { hasDropped } from "@/lib/upcoming";
import type { Release } from "@/lib/types/database";

/**
 * Data for /start — the first-rating screen (2026-10-05).
 *
 * The grid a brand-new member sees: records they're LIKELY TO KNOW,
 * so three ratings take a minute instead of a search session. Three
 * sources, dealt out in turn so no one flavour dominates:
 *
 *   1. STAPLES — a short hand-picked list of giants that are ALREADY in
 *      the catalog (STAPLE_SLUGS below: Thriller, Dark Side, channel
 *      ORANGE, Take Care…). Spotify's popularity column would have been
 *      the automatic version, but it's empty on every row we have
 *      (checked 2026-10-05), and the rest of the catalog is mostly
 *      recent and niche — great for the community, a poor "you know
 *      this one" grid on its own. A slug that isn't in the catalog
 *      just drops out, so editing the list is safe.
 *   2. MOST-REVIEWED here — the community's records (RPC from
 *      migration 034, the /releases "Popularity" tab).
 *   3. CURRENT — the newest drops (the home page's release feed).
 *
 * Unreleased records and not-yet-out countdown albums are left out on
 * purpose: this is "rate what you already know", and an unreleased
 * leak is the opposite of a safe first pick. (The wedge has its own
 * front door; this isn't it.)
 *
 * CACHED for 10 minutes and read with the cookie-less publicClient():
 * nothing in here depends on who's looking. The viewer's own
 * already-rated records are filtered out by the PAGE, outside the
 * cache — standing rule: nothing inside unstable_cache may touch
 * lib/supabase/server.ts (cookies() throws in there).
 */

/** One cover on the grid — just what the tile and the rater need. */
export interface StarterPick {
  id: string;
  slug: string;
  title: string;
  artist: string;
  cover_image: string;
  /** "2016" — shown under the title so two records with one name differ. */
  year: string | null;
}

/** How many covers the grid shows (8 rows of 3 on a phone). */
const GRID_SIZE = 24;
/** How many to pull from each automatic source before mixing. */
const PER_SOURCE = 30;

/**
 * The giants, by release slug, in the order they should appear —
 * classics and modern staples across genres. Every one was in the
 * catalog on 2026-10-05; add or swap freely (a missing slug is simply
 * skipped). Keep it to records a casual listener has an opinion on.
 */
const STAPLE_SLUGS = [
  "thriller-michael-jackson",
  "channel-orange-frank-ocean",
  "take-care-deluxe-drake",
  "the-dark-side-of-the-moon-pink-floyd",
  "igor-tyler-the-creator",
  "random-access-memories-daft-punk",
  "thank-u-next-ariana-grande",
  "graduation-kanye-west",
  "currents-tame-impala",
  "whole-lotta-red-playboi-carti",
  "beauty-behind-the-madness-the-weeknd",
  "in-rainbows-radiohead",
  "discovery-daft-punk",
  "ten-pearl-jam",
  "whats-the-story-morning-glory-oasis",
  "because-the-internet-childish-gambino",
  "speakerboxxxthe-love-below-outkast",
  "hybrid-theory-bonus-edition-linkin-park",
  "madvillainy-madvillain",
  "late-registration-kanye-west",
  "the-romantic-bruno-mars",
  "newjeans-2nd-ep-get-up-newjeans",
  "die-lit-playboi-carti",
  "hamilton-original-broadway-cast-recording-lin-manuel-miranda",
];

/** Is this a safe "you probably know it" pick? */
function eligible(r: { cover_image: string | null; is_unreleased?: boolean; release_date: string | null }) {
  if (!r.cover_image) return false; // a grid of covers needs covers
  if (r.is_unreleased) return false;
  // No date = an old import we can't place; let it through. A future
  // date = a countdown album nobody has heard yet.
  return !r.release_date || hasDropped(r.release_date);
}

/**
 * "Same record?" key. The catalog holds the single AND the album of
 * one title, and deluxe/remaster twins ("Swingin' Magic" next to
 * "Swingin' Magic - …"), which looked like a glitch side by side on
 * the grid. Compare on the title up to the first " - " or "(", plus
 * the artist.
 */
function recordKey(title: string, artist: string): string {
  const base = title.split(/ - | \(|\(/)[0].trim().toLowerCase();
  return `${base}::${artist.trim().toLowerCase()}`;
}

async function getStarterPicksUncached(): Promise<StarterPick[]> {
  const supabase = publicClient();

  // Three independent reads, in parallel. Each is its own statement —
  // inside one Promise.all tuple the `as never` RPC args confuse
  // TypeScript's inference for the whole tuple.
  const staplesP = supabase.from("releases").select("*").in("slug", STAPLE_SLUGS);
  const reviewedP = supabase.rpc("list_releases_by_review_count", {
    p_limit: PER_SOURCE,
    p_offset: 0,
    p_artist_id: null,
  } as never);
  // Already cached on its own (60s) — and already public-client.
  const currentP = getReleaseDiscoveryFeed(PER_SOURCE).catch(() => []);

  const { data: staplesData } = await staplesP;
  // Destructured (not res.error / res.data) so TypeScript doesn't narrow
  // the untyped RPC result to `never` — same shape listReleases uses.
  const { data: reviewedData, error: reviewedError } = await reviewedP;
  const current = await currentP;

  // Staples come back in database order — put them back in list order.
  const order = new Map(STAPLE_SLUGS.map((slug, i) => [slug, i]));
  const staples = ((staplesData ?? []) as unknown as Release[])
    .filter(eligible)
    .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  // Before migration 034 the RPC doesn't exist — the other two sources
  // still fill the grid.
  const reviewed = (!reviewedError && reviewedData
    ? (reviewedData as unknown as Release[])
    : []
  ).filter(eligible);

  // Artist names for sources 1 + 2 in one query (the RPC can't carry a
  // PostgREST join — same trick listReleases uses).
  const artistIds = [
    ...new Set([...staples, ...reviewed].map((r) => r.primary_artist_id).filter(Boolean)),
  ];
  const names = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data } = await supabase.from("artists").select("id, name").in("id", artistIds);
    for (const a of (data ?? []) as { id: string; name: string }[]) names.set(a.id, a.name);
  }

  const fromRelease = (r: Release): StarterPick => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    artist: names.get(r.primary_artist_id) ?? "",
    cover_image: r.cover_image!,
    year: r.release_date ? r.release_date.slice(0, 4) : null,
  });

  const lists: StarterPick[][] = [
    staples.map(fromRelease),
    reviewed.map(fromRelease),
    current
      .filter((r) => eligible({ cover_image: r.cover_image, release_date: r.release_date }))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        artist: r.primary_artist.name,
        cover_image: r.cover_image!,
        year: r.release_date ? r.release_date.slice(0, 4) : null,
      })),
  ];

  // Round-robin: one from each source in turn, skipping repeats (same
  // release, or the same record in another edition), so the first
  // screenful is already a mix of "the giants", "what people here
  // rate" and "what just dropped".
  const out: StarterPick[] = [];
  const seenIds = new Set<string>();
  const seenRecords = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const pick = list[i];
      if (!pick || seenIds.has(pick.id)) continue;
      const key = recordKey(pick.title, pick.artist);
      if (seenRecords.has(key)) continue;
      seenIds.add(pick.id);
      seenRecords.add(key);
      out.push(pick);
    }
  }
  // Everything that survived, not just GRID_SIZE: the page drops the
  // viewer's already-rated records and still needs a full grid.
  return out;
}

const getStarterPicksCached = unstable_cache(getStarterPicksUncached, ["starter-picks"], {
  revalidate: 600,
});

/**
 * The grid for one viewer: the cached mix minus anything they've
 * already reviewed (published or draft — POST /api/reviews would
 * answer 409 for either), trimmed to the grid size.
 */
export async function getStarterPicks(alreadyReviewed: Set<string>): Promise<StarterPick[]> {
  const all = await getStarterPicksCached().catch(() => [] as StarterPick[]);
  return all.filter((p) => !alreadyReviewed.has(p.id)).slice(0, GRID_SIZE);
}
