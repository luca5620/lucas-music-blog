/**
 * Review detail page — Overhaul v2, fully DB-driven.
 * One review by one member about one real catalog release. Shows the
 * reviewer's identity (with verified badge), links back to the
 * canonical release page, and keeps likes + comments.
 *
 * Layout = "sleeve option 1" (Luca 2026-10-24): no box around the
 * review; the cover with the record slid out to its right and the score
 * on the record label (ReviewSleeve), one Like · Comment · Share · ⋯ row
 * (ReviewActions — Report lives in ⋯), the words at reading size, then
 * Personal Favorites and the author's Song by song list (ReviewSongList).
 *
 * Round 4 (Luca 2026-10-24): the words get their own clearly marked
 * section ("THE REVIEW" — "it is the centerpiece of the app"), the
 * author gets an Edit button, an edited review shows its last-edited
 * date under the original one, and on a song-by-song review the ♥s in
 * the song list ARE the personal favourites (no repeated section).
 */

import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import UserLink from "@/components/ui/UserLink";
import { getReviewWithContextBySlug } from "@/lib/db/reviews";
import { getReleaseBySlug } from "@/lib/db/releases";
import { getMemberTrackRatings } from "@/lib/db/track-ratings";
import {
  resolveAppleMusic,
  resolveAppleSongIds,
  appleMusicEmbedSrc,
  appleMusicUrl,
} from "@/lib/apple-music";
import FavoritePlayers, { type FavoriteTrack } from "@/components/reviews/FavoritePlayers";
import { getGenreColor } from "@/lib/rating";
import { BreadcrumbSchema, ReviewSchema } from "@/app/schema";
import { createClient } from "@/lib/supabase/server";
import CommentsSection from "@/components/reviews/CommentsSection";
import BackLink from "@/components/ui/BackLink";
import GifView from "@/components/ui/GifView";
import { gifFromRow } from "@/lib/gif";
import ReviewActions from "@/components/reviews/ReviewActions";
import ReviewSleeve from "@/components/reviews/ReviewSleeve";
import ReviewSongList, { type ReviewSong } from "@/components/reviews/ReviewSongList";
import CoverLiquidSync from "@/components/ui/CoverLiquidSync";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
// LANGUAGES: page copy (messages → reviews.page); dates in the viewer's locale.
import { getLocale, getTranslations } from "next-intl/server";

// Community content changes constantly — always render fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const review = await getReviewWithContextBySlug(slug);
  // Dead review URL (deleted review, or a pre-pivot leftover Google
  // still holds): permanently redirect to the release page when one
  // lives at the same slug, so the URL's search equity lands
  // somewhere real instead of a soft-404. Done HERE and not only in
  // the page body because the root loading.tsx streams the shell
  // (status 200) before the body runs — metadata resolves earlier,
  // so crawlers get a real 308. (Luca 2026-08-31, GSC: the old
  // echoes-of-silence-the-weeknd review page draws impressions.)
  if (!review) {
    const release = await getReleaseBySlug(slug);
    if (release) permanentRedirect(`/releases/${slug}`);
    notFound(); // real 404, not a soft one — see app/not-found.tsx
  }

  const desc =
    review.snippet ||
    `${review.rating}/10 for ${review.title} by ${review.artist} on Peak Music Reviews.`;

  return {
    title: `${review.title} by ${review.artist} — review by ${review.profiles.username}`,
    description: desc,
    openGraph: {
      type: "music.album",
      url: `https://peakmusicreviews.com/reviews/${slug}`,
      title: `${review.title} by ${review.artist} — Peak Music Reviews`,
      description: desc,
      ...(review.cover_image && {
        images: [
          {
            url: review.cover_image,
            width: 1200,
            height: 1200,
            alt: `${review.title} by ${review.artist} album cover`,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${review.title} by ${review.artist} — Peak Music Reviews`,
      description: desc,
      ...(review.cover_image && { images: [review.cover_image] }),
    },
    alternates: {
      canonical: `https://peakmusicreviews.com/reviews/${slug}`,
    },
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Viewer id lets the query return the viewer's own drafts.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const review = await getReviewWithContextBySlug(slug, user?.id);
  if (!review) {
    // Same dead-URL rescue as generateMetadata (see the note there).
    const release = await getReleaseBySlug(slug);
    if (release) permanentRedirect(`/releases/${slug}`);
    notFound();
  }

  const author = review.profiles;
  const release = review.releases;
  // Optional GIF reaction (migration 058); null when there is none.
  const reviewGif = gifFromRow(review);
  const isVerified = author.role !== "user";
  // The author's per-song scores on this record (migration 041) —
  // rendered as the "Song by song" list under Personal Favorites when
  // they've rated at least one track. Fails soft to nothing.
  const authorTrackRatings =
    release && (release.tracks ?? []).length > 0
      ? await getMemberTrackRatings(review.user_id, release.id)
      : {};
  const ratedTracks = release
    ? (release.tracks ?? []).filter((tr) => authorTrackRatings[tr.position] !== undefined)
    : [];
  /* ── Personal Favorites, with a player on every pick (Luca
     2026-09-15). The card used to be a list of titles linking out to
     Spotify; now each pick opens THE VIEWER'S OWN preview player
     inline, the same service rule the release page follows:
     preferred_player = apple → Apple's song player, everyone else →
     Spotify's track player. (A saved SoundCloud pick — that player
     was removed 2026-10-24 — falls back to Spotify like it does
     everywhere else.)

     Apple costs ONE extra public iTunes lookup per page, and only
     for members who picked Apple Music: the cached album id has no
     per-song ids on it, so resolveAppleSongIds matches the picked
     titles against the album's song list. Anything that misses —
     Apple doesn't carry the record, a title doesn't match, the
     lookup fails — falls back to the Spotify player for that one
     row, and a pick with no id at all stays the plain line it was. ── */
  const favoritePicks = review.standout_tracks ?? [];
  let favoriteTracks: FavoriteTrack[] = [];
  if (favoritePicks.length > 0) {
    let preferred: string | undefined;
    if (user) {
      const { data: pref } = await supabase
        .from("profiles")
        .select("preferred_player")
        .eq("id", user.id)
        .maybeSingle();
      preferred = (pref as { preferred_player?: string } | null)?.preferred_player;
    }

    let appleAlbumId: string | null = null;
    let appleSongIds = new Map<string, string>();
    if (preferred === "apple" && release) {
      const apple = await resolveAppleMusic(release, review.artist ?? "");
      if (apple) {
        appleAlbumId = apple.albumId;
        appleSongIds = apple.trackId
          ? // A single: the cached ref already points at the song.
            new Map([[favoritePicks[0].title, apple.trackId]])
          : await resolveAppleSongIds(
              apple.albumId,
              favoritePicks.map((p) => p.title)
            );
      }
    }

    favoriteTracks = favoritePicks.map((pick) => {
      const appleTrackId = appleSongIds.get(pick.title);
      if (appleAlbumId && appleTrackId) {
        const ref = { albumId: appleAlbumId, trackId: appleTrackId };
        return {
          title: pick.title,
          src: appleMusicEmbedSrc(ref),
          source: "apple" as const,
          openUrl: appleMusicUrl(ref),
        };
      }
      // The id is re-derived from the stored link and shape-checked
      // before it goes anywhere near an iframe src — we wrote that
      // link ourselves from the catalog, but the rule is the rule.
      const link = pick.spotifyUrl ?? "";
      const id = link.match(/\/track\/([A-Za-z0-9]{22})/)?.[1];
      return {
        title: pick.title,
        src: id ? `https://open.spotify.com/embed/track/${id}?theme=0` : null,
        source: "spotify" as const,
        openUrl: link,
      };
    });
  }

  const t = await getTranslations("reviews.page");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const longDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  // "Edited …" only for a real edit: updateReview stamps updated_at, and
  // anything within 10 minutes of posting (a quick typo fix, a draft
  // published straight away) doesn't count.
  const editedAt =
    new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 10 * 60 * 1000
      ? new Date(review.updated_at).toLocaleDateString(locale, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const isOwner = !!user && user.id === review.user_id;

  // Likes: count + whether the viewer already liked it.
  let likeCount = 0;
  let viewerHasLiked = false;
  try {
    const { count } = await supabase
      .from("review_likes")
      .select("id", { count: "exact", head: true })
      .eq("review_id", review.id);
    likeCount = count ?? 0;

    if (user) {
      const { data: liked } = await supabase
        .from("review_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("review_id", review.id)
        .maybeSingle();
      viewerHasLiked = !!liked;
    }
  } catch {
    // Likes are decorative — never block the page on them.
  }

  // Song by song (sleeve option 1): every song the author rated, in
  // album order, with a ♥ on their personal favourites.
  const favoriteTitles = new Set(favoritePicks.map((p) => p.title));
  const reviewSongs: ReviewSong[] = ratedTracks.map((track) => ({
    position: track.position,
    title: track.title,
    spotify_id: track.spotify_id ?? null,
    score: authorTrackRatings[track.position],
    favorite: favoriteTitles.has(track.title),
  }));
  const showSongList = !!release && reviewSongs.length > 0 && (release.tracks ?? []).length >= 2;
  // On a song-by-song review the ♥s in the song list ARE the personal
  // favourites, so the separate section would just repeat them (Luca
  // 2026-10-24). It stays when a pick isn't in the list (a favourite
  // they didn't score) and on every review that isn't song by song.
  const favoritesInList =
    showSongList && favoritePicks.length > 0 && favoritePicks.every((p) => reviewSongs.some((s) => s.title === p.title && s.favorite));

  // "Album · 2001" — the year from the release date when there is one.
  const typeLabel = review.release_type
    ? review.release_type.charAt(0).toUpperCase() + review.release_type.slice(1)
    : null;
  const year = review.release_date ? review.release_date.slice(0, 4) : null;

  return (
    <div className="review-page space-y-6 max-w-3xl lg:max-w-5xl mx-auto">
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Reviews", href: "/reviews" },
          {
            name: `${review.title} by ${review.artist}`,
            href: `/reviews/${review.slug}`,
          },
        ]}
      />
      <ReviewSchema
        review={{
          slug: review.slug,
          title: review.title,
          artist: review.artist,
          rating: review.rating,
          genre: review.genre,
          release_type: review.release_type,
          release_date: review.release_date,
          review_date: review.review_date,
          snippet: review.snippet,
          summary: review.summary,
          cover_image: review.cover_image,
          standout_tracks: review.standout_tracks,
        }}
        authorName={author.display_name || author.username}
        authorUrl={`https://peakmusicreviews.com/profile/${author.username}`}
      />

      {/* The site-wide liquid light takes this album's colours while
          you're on the page. */}
      <CoverLiquidSync coverUrl={review.cover_image} />

      {/* Back link */}
      <BackLink
        fallback="/reviews"
        label={tc("back")}
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      />

      {/* Draft banner (only the owner ever sees a draft) */}
      {!review.is_published && (
        <div className="panel-xbox p-3 border-yellow-500/30 bg-yellow-500/5">
          <p className="pixel-text text-sm text-yellow-400">
            {t("draft")}
          </p>
        </div>
      )}

      {/* ========== THE SLEEVE (Luca 2026-10-24, option 1) ==========
          No box around the review any more: the record and its sleeve
          sit straight on the page. Phones stack sleeve → title; desktop
          puts the title beside the sleeve, bottom-aligned. (A local liquid glow was tried
          here and drew a visible rectangle — the site-wide wash, recoloured
          by CoverLiquidSync, is the only light.) */}
      <header className="review-head">
        <ReviewSleeve
          cover={review.cover_image}
          coverAlt={tc("coverAlt", { title: review.title })}
          rating={review.rating}
          outOfLabel={t("outOf")}
          unreleasedLabel={release?.is_unreleased ? tc("unreleased") : null}
        />

        <div className="review-head-text">
          {review.genre && (
            <p className={`pixel-text text-[11px] uppercase tracking-widest ${getGenreColor(review.genre)}`}>
              {review.genre}
            </p>
          )}
          <h1 className="crt-title text-[1.75rem] leading-tight sm:text-4xl lg:text-5xl break-words">
            {release ? (
              <Link href={`/releases/${release.slug}`} className="hover:text-accent-glow transition-colors">
                {review.title}
              </Link>
            ) : (
              review.title
            )}
          </h1>
          <p className="text-base text-text-secondary mt-1">
            {[review.artist, typeLabel, year].filter(Boolean).join(" · ")}
          </p>

          {/* Who wrote it, and when */}
          <div className="flex items-center gap-2.5 mt-4 text-sm flex-wrap">
            <UserLink username={author.username} className="inline-flex items-center gap-2 group">
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border border-white/10"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
                  {(author.username || "U")[0]}
                </span>
              )}
              <span className="font-bold text-text-primary group-hover:text-accent-glow transition-colors">
                {author.display_name || author.username}
              </span>
              {isVerified && <VerifiedBadge role={author.role} />}
            </UserLink>
          </div>
          {/* The original review date, and the last edit right under it. */}
          {(review.review_date || editedAt) && (
            <div className="review-dates">
              {review.review_date && <span>{t("reviewed", { date: longDate(review.review_date) })}</span>}
              {editedAt && <span>{t("edited", { date: editedAt })}</span>}
            </div>
          )}
        </div>
      </header>

      {/* Like · Comment · Share · ⋯ (release page + Report inside ⋯) */}
      <ReviewActions
        reviewId={review.id}
        likeCount={likeCount}
        liked={viewerHasLiked}
        card={{
          title: review.title,
          artist: review.artist,
          year,
          typeLabel,
          rating: review.rating,
          handle: author.username,
          avatarUrl: author.avatar_url,
          coverUrl: review.cover_image,
          quote: review.snippet || null,
          // The scorecard rolls in only the songs they scored.
          songs: reviewSongs.map((s) => ({ n: s.position, title: s.title, score: s.score })),
          url: `https://peakmusicreviews.com/reviews/${review.slug}`,
          shareTitle: `${review.title} by ${review.artist} — ${author.display_name || author.username} on Peak Music`,
          slug: review.slug,
        }}
        releaseHref={release ? `/releases/${release.slug}` : null}
        editHref={isOwner ? `/reviews/${review.slug}/edit` : null}
        labels={{
          edit: t("edit"),
          comment: t("comment"),
          share: t("share"),
          more: t("more"),
          viewRelease: t("viewRelease"),
        }}
      />

      {/* THE REVIEW — its own clearly marked section (Luca 2026-10-24:
          "it is the centerpiece of the app"). The one-liner leads as a
          pull quote when there's a full review under it too. */}
      {/* A rating with no words and no GIF keeps the plain one-liner —
          an empty-looking box would be worse than none. */}
      {!review.summary && !review.snippet && !reviewGif ? (
        <p className="text-text-muted leading-relaxed text-base italic">{t("noWords")}</p>
      ) : (
      <section className="review-body" aria-label={t("theReview")}>
        <p className="review-body-label">{t("theReview")}</p>
        {review.summary ? (
          <>
            {review.snippet && review.snippet.trim() !== review.summary.trim() && (
              <p className="review-quote">{review.snippet}</p>
            )}
            <p className="review-words whitespace-pre-line">{review.summary}</p>
          </>
        ) : review.snippet ? (
          <p className="review-words">{review.snippet}</p>
        ) : null}
        {/* GIF reaction (migration 058) — at the bottom of the
            review, on its own or under the words. */}
        {reviewGif && <GifView gif={reviewGif} />}
      </section>
      )}

      {/* Personal Favorites, each with the viewer's own player (the
          standout_tracks column keeps its name — display label only). */}
      {review.standout_tracks.length > 0 && !favoritesInList && (
        <section className="space-y-2">
          <h2 className="review-h">
            <span>{t("favorites")}</span>
            {/* Only promise a player when there is one to play. */}
            {favoriteTracks.some((f) => f.src) && <small>{t("previewHint")}</small>}
          </h2>
          <FavoritePlayers tracks={favoriteTracks} />
        </section>
      )}

      {/* Song by song — the author's per-song scores (track_ratings,
          migration 041). Only the songs they actually rated, and only on
          records with 2+ songs (on a single the score above IS the song). */}
      {release && showSongList && (
        <section className="space-y-1">
          <h2 className="review-h">
            <span>{t("songBySong", { n: reviewSongs.length })}</span>
          </h2>
          {/* heads-up: the hearts are the personal favourites */}
          {favoritesInList && <p className="review-h-note">{t("favoritesInList")}</p>}
          <ReviewSongList
            releaseId={release.id}
            songs={reviewSongs}
            single={(release.tracks ?? []).length === 1}
            labels={{
              showAll: t("showAllSongs", { n: reviewSongs.length }),
              showFewer: t("showFewer"),
              favorite: t("favorites"),
            }}
          />
        </section>
      )}

      {/* Comments Section */}
      {/* id anchors the Taste fullscreen rail's 💬 deep link */}
      <div id="comments" className="scroll-mt-24">
        <CommentsSection reviewId={review.id} />
      </div>
    </div>
  );
}
