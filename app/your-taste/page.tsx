/**
 * /your-taste — PEAK TV: the station lobby.
 *
 * The page IS a TV station now (taste-overhaul round 3, "broadcast"
 * design). No more PageHero/section-label chrome — top to bottom:
 *
 *  1. STATION IDENT masthead — "PEAK TV" in CRT type with the chrome
 *     disc spinning behind it, subtitled with the viewer's own
 *     channel name.
 *  2. SIGNAL METER + transmitter receipts — an honest read of how
 *     much taste signal we actually have, and for warm users the
 *     top-3 artists WITH the reason the algorithm holds for each
 *     ("you follow Björk") — the algorithm showing its work. Cold
 *     accounts get "SCANNING…" and NO receipts: we never fake
 *     personalization we don't have.
 *  3. TONIGHT'S PROGRAMMING — the EPG + GO LIVE (TasteGuide, client).
 *     Entry into the fullscreen broadcast is opt-in only; the lobby
 *     never auto-enters (App Review is pending).
 *
 * Server component; auth required (middleware gates nothing here, so
 * we redirect ourselves via requireAuth).
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ChromeDisc from "@/components/ui/ChromeDisc";
import TasteGuide from "@/components/taste/TasteGuide";
import { buildTasteProfile, getTunedToYou } from "@/lib/taste";
import { thumbCover } from "@/lib/images";

export const metadata = {
  title: "Your Taste",
  robots: { index: false, follow: false },
};

// Per-viewer page — always render fresh.
export const dynamic = "force-dynamic";

/**
 * The rotation cookie: comma-separated tunedKeyOf strings of channels
 * the viewer already watched (the client keeps the last 40). The mix
 * engine downranks these ×0.35 so reruns rotate out of prime time.
 *
 * ⚠️ PATH-SCOPED: the client writes this cookie with
 * `path=/your-taste`, so it only rides along on THIS route's
 * requests. Rename the route and the cookie silently stops arriving —
 * rotation dies with no error anywhere. If /your-taste ever moves,
 * move the cookie path in the fullscreen frame's write too.
 */
const TASTE_SEEN_COOKIE = "pmr_taste_seen";

/** Only https:// or local /path images (stored-XSS defense — same
    guard every taste surface applies before rendering a stored URL). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

export default async function YourTastePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  /* ---- Taste profile + the people the viewer follows (the pager
     boosts followed authors and says so in its reason chips) ---- */
  const profile = await buildTasteProfile(user.id);

  // The viewer's own profile (for the channel name) and their people
  // follows — independent queries, so they run in parallel.
  const [viewerProfileRes, peopleFollowsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single(),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
  ]);
  // Same cast-the-row pattern the layout uses — the generated DB types
  // don't narrow .single() results here.
  const viewerProfile = (viewerProfileRes.data ?? null) as {
    username: string;
    display_name: string | null;
  } | null;
  const peopleIds = (
    (peopleFollowsRes.data ?? []) as { following_id: string }[]
  ).map((r) => r.following_id);
  // "THE {NAME} CHANNEL" — display name first, handle as fallback.
  // osd-text uppercases in CSS, so we pass the name through as-is.
  const channelName =
    viewerProfile?.display_name || viewerProfile?.username || "YOUR";

  /* ---- Seen channels — read the rotation cookie and hand the keys
     to the mix engine (server half of the seen-downrank; the client
     write lives in the fullscreen frame). Absent cookie = empty
     list, first-visit behavior. ---- */
  const cookieStore = await cookies();
  const seenRaw = cookieStore.get(TASTE_SEEN_COOKIE)?.value ?? "";
  const seenKeys = seenRaw.split(",").filter(Boolean);

  /* ---- The TUNED TO YOU picks ---- */
  const tunedItems = await getTunedToYou(profile, user.id, {
    followedUserIds: peopleIds,
    seenKeys,
  });

  /* ---- Signal meter: three honesty tiers keyed off signalCount
     (the same number the mix engine's cold-start fade runs on, so
     the label and the actual blend can never disagree):
       ≥10  → STRONG (full taste blend)
       3–9  → WEAK   (taste blended in, still thin)
       <3   → SCANNING — the feed is basically popularity, SAY SO.
     Cold accounts also get NO receipts below: showing "your top
     artists" off two clicks of data would be faking it. ---- */
  const warm = profile.signalCount >= 3;
  const signalLine =
    profile.signalCount >= 10
      ? `SIGNAL: STRONG · ${profile.signalCount} SIGNALS`
      : warm
        ? `SIGNAL: WEAK · ${profile.signalCount} SIGNALS`
        : "SCANNING… WEAK SIGNAL — TUNED TO WHAT'S HOT";

  /* ---- Transmitter receipts (warm users only): the top-3 affinity
     artists with the algorithm's ACTUAL reason string for each.
     Names/weights ride the profile; the artist photos need one extra
     .in() query (image_url isn't part of any taste signal, so the
     profile builder rightly doesn't fetch it). ---- */
  let receipts: {
    id: string;
    name: string;
    reason: string | null;
    image: string | null;
  }[] = [];
  if (warm && profile.topArtists.length > 0) {
    const { data: artistRows } = await supabase
      .from("artists")
      .select("id, image_url")
      .in(
        "id",
        profile.topArtists.map((a) => a.id)
      );
    const imageById = new Map(
      ((artistRows ?? []) as { id: string; image_url: string | null }[]).map(
        (a) => [a.id, a.image_url]
      )
    );
    receipts = profile.topArtists.map((a) => ({
      id: a.id,
      name: a.name,
      reason: profile.reasonByArtistId.get(a.id) ?? null,
      // thumbCover: 64px variant for Spotify covers; artist photos and
      // other hosts pass through untouched. Rendered at 32px — never
      // ship a big file into a chip-sized slot.
      image: thumbCover(safeImage(imageById.get(a.id) ?? null)),
    }));
  }

  return (
    <div className="space-y-8 pb-12">
      {/* ===== STATION IDENT — the masthead. Same boxed-panel
             treatment as the old PageHero (glow panel + chrome disc
             behind the right edge + dark scrim for legibility), but
             the content is the station identity, not a page title. ===== */}
      <section className="panel-xbox-glow p-6 sm:p-8 relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {/* Phones: centered behind the centered title. sm+: behind
              the right edge, matching the left-aligned text. */}
          <ChromeDisc className="absolute w-36 left-1/2 -translate-x-1/2 -top-10 sm:left-auto sm:translate-x-0 sm:w-56 sm:-right-16 sm:-top-14 md:w-72 md:-right-10 opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/35 to-black/10" />
        </div>

        <div className="space-y-3 text-center sm:text-left">
          <h1 className="crt-title text-4xl sm:text-5xl">PEAK TV</h1>
          {/* The viewer's own channel — osd-text uppercases it */}
          <p className="osd-text text-xs sm:text-sm">
            THE {channelName} CHANNEL — TUNED TO YOU
          </p>

          {/* Signal meter — the honesty line */}
          <p className="osd-text text-[11px] opacity-80">{signalLine}</p>

          {/* Transmitter receipts — top-3 artists + the reason we
              hold for each. Warm users only (see the tier comment). */}
          {receipts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2.5 justify-center sm:justify-start"
                >
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase shrink-0">
                      {r.name[0]}
                    </span>
                  )}
                  <span className="text-sm text-text-secondary min-w-0 truncate">
                    <span className="font-bold text-text-primary">
                      {r.name}
                    </span>
                    {r.reason && <> — {r.reason}</>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="scan-bar" />
      </section>

      {/* ===== TONIGHT'S PROGRAMMING + GO LIVE (client), or the NO
             SIGNAL static panel when the mix came back empty ===== */}
      {tunedItems.length > 0 ? (
        <TasteGuide items={tunedItems} />
      ) : (
        <div className="panel-xbox p-6 sm:p-8 text-center space-y-4">
          <p className="osd-text text-sm">NO SIGNAL</p>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Static, for now. Rate a few releases and follow some people —
            your channel tunes itself from what you love.
          </p>
          <Link href="/releases" className="btn-y2k btn-y2k-outline inline-block">
            Browse Releases
          </Link>
        </div>
      )}
    </div>
  );
}
