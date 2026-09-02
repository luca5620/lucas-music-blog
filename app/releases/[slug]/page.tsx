/**
 * Release Detail Page — Phase 2a-3
 *
 * Server component. Shows cover + title + artist link, follow button,
 * tracks list, reviews attached to this release, and follower avatars.
 *
 * Layout mirrors `/reviews/[slug]` (cover-first, panel-xbox glow) and
 * borrows the colored-accent treatment from `/profile/[username]`.
 */

import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReleaseDescription } from "@/lib/descriptions";
import BackLink from "@/components/ui/BackLink";
import ShimmerLines from "@/components/ui/ShimmerLines";
import {
  getReleaseBySlug,
  getReleaseStats,
  getReleaseReviews,
  getReleaseFollowers,
  isFollowingRelease,
} from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import {
  getOrCreateRoom,
  getRoomMessages,
  getMessageReactionCounts,
  getViewerReactions,
} from "@/lib/db/rooms";
import { getUser } from "@/lib/auth";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { isUpcoming } from "@/lib/upcoming";
import LiveCountdown from "@/components/releases/LiveCountdown";
import SpotifyEmbed from "@/components/releases/SpotifyEmbed";
import FollowEntityButton from "@/components/follow/FollowEntityButton";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";
import CoverLiquidSync from "@/components/ui/CoverLiquidSync";
import ReleaseRoomChat from "@/components/rooms/ReleaseRoomChat";
import { type ChatMessageWithProfile } from "@/components/rooms/ChatPanel";
import { BreadcrumbSchema, ReleaseSchema } from "@/app/schema";
import type {
  Profile,
  Release,
  ReleaseRoom,
  ReleaseStats,
  ReleaseTrack,
} from "@/lib/types/database";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Letterboxd-style synopsis: manual → Genius → Wikipedia, with a
    source credit + link when the words came from outside. */
async function DescriptionBlock({
  release,
  artistName,
}: {
  release: Release;
  artistName: string;
}) {
  const desc = await getReleaseDescription({
    title: release.title,
    release_type: release.release_type,
    genius_id: release.genius_id,
    description: release.description,
    artistName,
    firstTrack: release.tracks?.[0]?.title ?? null,
  });
  if (!desc) return null;

  // Singles are songs; everything else (album/EP/mixtape/compilation)
  // reads as an album — the heading says which one this bio is for.
  const bioLabel =
    release.release_type === "single" ? "Song Bio" : "Album Bio";

  return (
    <>
      <div className="divider-glow" />
      <div className="flex items-center gap-2">
        <span className="glow-orb" />
        <span className="label-xbox">{bioLabel}</span>
      </div>
      <p className="text-text-secondary leading-relaxed text-sm md:text-base whitespace-pre-line">
        {desc.text}
      </p>
      {desc.source !== "manual" && (
        <p className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
          {desc.url ? (
            <a
              href={desc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-primary transition-colors"
            >
              {desc.source === "genius"
                ? "via Genius — lyrics & more ↗"
                : "via Wikipedia ↗"}
            </a>
          ) : desc.source === "genius" ? (
            "via Genius"
          ) : (
            "via Wikipedia"
          )}
        </p>
      )}
    </>
  );
}

/* ─────────────────────────  Metadata  ───────────────────────── */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) notFound(); // real 404, not a soft one — see app/not-found.tsx

  const [artist, stats] = await Promise.all([
    getArtistById(release.primary_artist_id),
    getReleaseStats(release.id).catch(() => null),
  ]);
  const artistName = artist?.name ?? "Unknown Artist";

  // Meta description: lead with the community rating when one exists,
  // then the synopsis. Collapse whitespace and cap near Google's
  // ~160-char snippet limit so long Genius blurbs don't get dumped raw.
  const ratingLead =
    stats && stats.review_count > 0 && stats.avg_rating !== null
      ? `Rated ${formatRating(stats.avg_rating)}/10 from ${stats.review_count} ${
          stats.review_count === 1 ? "review" : "reviews"
        }. `
      : "";
  const synopsis =
    release.description?.replace(/\s+/g, " ").trim() ||
    `${release.title} by ${artistName} — listen, follow, and read reviews on Peak Music Reviews.`;
  let description = ratingLead + synopsis;
  if (description.length > 160) {
    description = description.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  }

  return {
    title: `${release.title} by ${artistName} — Reviews & Ratings`,
    description,
    openGraph: {
      type: "music.album",
      url: `https://peakmusicreviews.com/releases/${slug}`,
      title: `${release.title} by ${artistName} — Peak Music Reviews`,
      description,
      ...(release.cover_image && {
        images: [
          {
            url: release.cover_image,
            width: 1200,
            height: 1200,
            alt: `${release.title} by ${artistName} cover`,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${release.title} by ${artistName} — Peak Music Reviews`,
      description,
      ...(release.cover_image && { images: [release.cover_image] }),
    },
    alternates: {
      canonical: `https://peakmusicreviews.com/releases/${slug}`,
    },
    other: {
      ...(release.release_date && {
        "music:release_date": release.release_date,
      }),
    },
  };
}

/* ─────────────────────────  Helpers  ───────────────────────── */

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

/* ─────────────────────────  Page  ───────────────────────── */

export default async function ReleasePage({ params }: Props) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) notFound();

  const artist = await getArtistById(release.primary_artist_id);

  const user = await getUser();

  const [stats, reviewsRaw, followers, isFollowing, room] = await Promise.all([
    getReleaseStats(release.id),
    getReleaseReviews(release.id),
    getReleaseFollowers(release.id, 12),
    user ? isFollowingRelease(user.id, release.id) : Promise.resolve(false),
    getOrCreateRoom(release.id).catch(() => null),
  ]);

  const reviews = reviewsRaw as unknown as ReviewWithProfile[];

  // Track-level emoji reactions were removed 2026-08-19 (Luca: too
  // cluttered) — the live chat room stays, the per-track emoji rows go.
  // Message-level reactions replaced them (2026-08-19, live-chat overhaul).
  const initialMessages = room
    ? ((await getRoomMessages(room.id, {
        limit: 30,
      })) as ChatMessageWithProfile[])
    : ([] as ChatMessageWithProfile[]);

  const [initialReactionCounts, viewerReactionsRaw] = await Promise.all([
    getMessageReactionCounts(initialMessages.map((m) => m.id)),
    user && room ? getViewerReactions(user.id, room.id) : Promise.resolve([]),
  ]);
  // getViewerReactions also returns the viewer's leftover track reactions;
  // keep only message-targeted rows for the chat UI.
  const initialViewerReactions = viewerReactionsRaw
    .filter((r): r is typeof r & { message_id: string } => !!r.message_id)
    .map((r) => ({ message_id: r.message_id, emoji: r.emoji }));

  const accentColor =
    stats.avg_rating !== null ? getRatingHex(stats.avg_rating) : "#1e90ff";

  const tracks = (release.tracks ?? []) as ReleaseTrack[];

  const releaseDateFormatted = formatDate(release.release_date);
  const artistName = artist?.name ?? "Unknown Artist";
  const artistSlug = artist?.slug;

  return (
    <div
      // overflow-x-clip (not hidden): clips sideways bleed WITHOUT
      // creating a scroll container, which would kill the sticky
      // chat column on desktop. max-w-7xl fits the third column.
      // pb below xl: the fixed LIVE ROOM bar (ReleaseRoomChat) hugs
      // the bottom on phones — without this it covers the last rows.
      className="space-y-6 max-w-3xl xl:max-w-7xl mx-auto overflow-x-clip pb-14 xl:pb-0"
      style={
        {
          "--release-accent": accentColor,
        } as React.CSSProperties
      }
    >
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Releases", href: "/releases" },
          {
            name: `${release.title} by ${artistName}`,
            href: `/releases/${release.slug}`,
          },
        ]}
      />
      <ReleaseSchema
        release={release}
        artistName={artistName}
        artistSlug={artistSlug}
        stats={stats}
        reviews={reviews.map((r) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return {
            slug: r.slug,
            rating: r.rating,
            summary: r.summary,
            snippet: r.snippet,
            created_at: r.created_at,
            authorName: p?.display_name ?? p?.username ?? "Anonymous",
            authorUsername: p?.username ?? null,
          };
        })}
      />

      {/* Back link */}
      <BackLink
        fallback="/releases"
        label="Back"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      />

      <ReleaseContent
        release={release}
        stats={stats}
        isFollowing={isFollowing}
        accentColor={accentColor}
        tracks={tracks}
        room={room}
        initialMessages={initialMessages}
        initialReactionCounts={initialReactionCounts}
        initialViewerReactions={initialViewerReactions}
        reviews={reviews}
        followers={followers}
        releaseDateFormatted={releaseDateFormatted}
        artistName={artistName}
        artistSlug={artistSlug}
      />
    </div>
  );
}

/* ─────────────────────────  Release content  ───────────────────────── */

interface ReleaseContentProps {
  release: Release;
  stats: ReleaseStats;
  isFollowing: boolean;
  accentColor: string;
  tracks: ReleaseTrack[];
  room: ReleaseRoom | null;
  initialMessages: ChatMessageWithProfile[];
  initialReactionCounts: { message_id: string; emoji: string; count: number }[];
  initialViewerReactions: { message_id: string; emoji: string }[];
  reviews: ReviewWithProfile[];
  followers: Profile[];
  releaseDateFormatted: string | null;
  artistName: string;
  artistSlug: string | undefined;
}

function ReleaseContent({
  release,
  stats,
  isFollowing,
  accentColor,
  tracks,
  room,
  initialMessages,
  initialReactionCounts,
  initialViewerReactions,
  reviews,
  followers,
  releaseDateFormatted,
  artistName,
  artistSlug,
}: ReleaseContentProps) {
  // Countdown album: the page (and its live room) exists BEFORE the
  // music does. isUpcoming flips to false on release day by itself.
  const upcoming = isUpcoming(release.release_date);

  return (
    // release-unclip: at xl the panel switches to overflow:visible so
    // the sticky chat column works (sticky dies inside overflow:
    // hidden). Safe because LiquidAtmosphere clips its own blobs and
    // CoverLiquidSync renders nothing. See globals.css.
    <div className="panel-xbox-glow release-unclip p-4 sm:p-6 md:p-8 relative isolate">
      {/* Molten light drifting behind the whole release panel — and
          the whole site's liquid takes this album's palette while
          you're here (Luca 2026-08-25: cover-colored immersion). */}
      <CoverLiquidSync coverUrl={release.cover_image} />

      {/* Countdown banner — big OSD-amber broadcast strip. This is the
          "waiting room" signal: follow the release, sit in the chat,
          be here when it drops. */}
      {upcoming && release.release_date && (
        <div className="mb-5 sm:mb-6 border border-osd-amber/50 rounded-lg bg-osd-amber/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <span className="pixel-text text-xs sm:text-sm text-osd-amber uppercase tracking-widest">
            ⏳ DROPS IN{" "}
            <LiveCountdown
              releaseDate={release.release_date}
              className="animate-pulse"
            />
            {releaseDateFormatted ? ` — ${releaseDateFormatted}` : ""}
          </span>
        </div>
      )}
      <LiquidAtmosphere />
      {/* On desktop (xl+) the page splits three ways: identity on the
          left, preview + reviews in the middle, and the LIVE CHAT as
          its own column running down the whole right side (sticky,
          viewport-height — it rides along while you scroll reviews).
          On phones everything stacks exactly like before. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,380px)] xl:gap-8 xl:items-start">
      <div className="space-y-5 sm:space-y-6">
        {/* Cover Image */}
        <div
          className="aspect-square max-w-md mx-auto xl:mx-0 rounded-lg bg-bg-elevated flex items-center justify-center overflow-hidden border-2"
          style={{
            borderColor: `${accentColor}40`,
            boxShadow: `0 0 32px ${accentColor}30, 0 0 64px ${accentColor}15`,
          }}
        >
          {release.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={release.cover_image}
              alt={`${release.title} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl text-text-muted">{"//"}</span>
          )}
        </div>

        {/* Title + Artist */}
        <div className="space-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-5xl xl:text-4xl font-extrabold text-text-primary break-words">
            {release.title}
          </h1>
          {artistSlug ? (
            <Link
              href={`/artists/${artistSlug}`}
              className="text-lg text-accent-primary hover:text-accent-glow transition-colors inline-block"
            >
              {artistName}
            </Link>
          ) : (
            <p className="text-lg text-text-secondary">{artistName}</p>
          )}
        </div>

        {/* Type pill + release date */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="label-xbox text-[0.6rem]">
            {release.release_type.toUpperCase()}
          </span>
          {releaseDateFormatted && (
            <span
              className={
                upcoming ? "text-osd-amber text-xs" : "text-text-muted text-xs"
              }
            >
              {upcoming ? "Drops" : "Released"} {releaseDateFormatted}
            </span>
          )}
        </div>

        {/* Community pulse: everyone's ratings in one picture —
            average, review count, and the spread of scores. */}
        <div className="card-y2k p-4 space-y-3">
          {stats.avg_rating !== null ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={`rating-badge text-2xl ${getRatingColor(stats.avg_rating)}`}
                >
                  {formatRating(stats.avg_rating)}
                </div>
                <div className="space-y-0.5">
                  <p className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                    Community average
                  </p>
                  <p className="text-xs text-text-secondary">
                    from {stats.review_count}{" "}
                    {stats.review_count === 1 ? "review" : "reviews"} ·{" "}
                    {stats.follower_count}{" "}
                    {stats.follower_count === 1 ? "follower" : "followers"}
                  </p>
                </div>
              </div>
              <RatingHistogram ratings={reviews.map((r) => r.rating)} />
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs text-text-muted italic">
                No reviews yet — the community average starts with the first one.
              </span>
              <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                {stats.follower_count}{" "}
                {stats.follower_count === 1 ? "follower" : "followers"}
              </span>
            </div>
          )}
        </div>

        {/* Follow button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <FollowEntityButton
            kind="release"
            entityId={release.id}
            initialFollowing={isFollowing}
            accentColor={accentColor}
            labelFollow="Follow this release"
            labelFollowing="Following"
          />
        </div>

        {/* Description — Letterboxd-style synopsis. Manual column →
            Genius about → Wikipedia intro (lib/descriptions.ts).
            Streamed so a slow external lookup never delays the page.
            PHONE ONLY here — on desktop the text leaves this narrow
            column and runs horizontally across the full-width band
            below (Luca 2026-08-26); the lookup is cached, so the
            second render costs nothing. */}
        <div className="xl:hidden space-y-5 sm:space-y-6">
          <Suspense fallback={<ShimmerLines lines={3} />}>
            <DescriptionBlock release={release} artistName={artistName} />
          </Suspense>
        </div>
      </div>

      {/* Middle column, row 1: the listening surface. The Spotify
          embed REPLACES the hand-rolled tracklist wherever it can
          render (same tracks, but playable) — the plain list only
          survives for Genius-only imports with no Spotify id.
          xl: flex column + self-stretch so the preview card fills
          the row and its bottom edge matches the live room's. */}
      <div className="space-y-5 sm:space-y-6 mt-5 sm:mt-6 xl:mt-0 xl:self-stretch xl:flex xl:flex-col">
        {!release.spotify_id && tracks.length > 0 && (
          <>
            <div className="divider-glow xl:hidden" />
            <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">Tracks</span>
              </div>

              <ol className="space-y-2">
                {tracks.map((track) => {
                  const spotifyHref = track.spotify_id
                    ? `https://open.spotify.com/track/${track.spotify_id}`
                    : null;
                  const duration = formatDuration(track.duration_ms);

                  const titleRow = (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="pixel-text text-sm text-text-muted shrink-0 w-6 tabular-nums">
                          {track.position}
                        </span>
                        <span className="text-sm font-medium text-text-primary truncate">
                          {track.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-text-muted tabular-nums">
                          {duration}
                        </span>
                        {spotifyHref && (
                          <span className="text-xs text-accent-primary whitespace-nowrap">
                            Spotify ↗
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <li
                      key={`${track.position}-${track.title}`}
                      data-track-position={track.position}
                      className="border-b border-border-subtle last:border-0 px-2 -mx-2 py-1.5"
                    >
                      {spotifyHref ? (
                        <a
                          href={spotifyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block py-1 rounded-lg hover:bg-bg-elevated/50 transition-colors"
                        >
                          {titleRow}
                        </a>
                      ) : (
                        <div className="py-1">{titleRow}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}

        {/* Spotify preview player — 30s snippets, streamed by Spotify
            under their licenses (we host no audio). */}
        <SpotifyEmbed release={release} tracks={tracks} />
      </div>

      {/* Live Room — its own grid column on desktop, filling row 1 so
          its bottom edge lines up flush with the other columns; the
          full-width reviews band runs underneath all three. On PHONES
          the chat leaves the flow entirely (Luca 2026-08-28):
          ReleaseRoomChat renders a fixed bottom bar + slide-up sheet
          instead, so the countdown / artwork / Spotify preview stay
          in view while the chat is up. */}
      <div className="xl:col-start-3 xl:row-start-1 xl:self-stretch">
        {room && (
          <div className="xl:h-full">
            <ReleaseRoomChat
              releaseId={release.id}
              initialMessages={initialMessages}
              initialRoom={room}
              accentColor={accentColor}
              initialReactionCounts={initialReactionCounts}
              initialViewerReactions={initialViewerReactions}
            />
          </div>
        )}
      </div>

      {/* Lower band — reviews + followers filling the WHOLE bottom
          width (all three columns) so the page reads flush. */}
      <div className="space-y-5 sm:space-y-6 mt-5 sm:mt-6 xl:mt-0 xl:col-start-1 xl:col-span-3 xl:row-start-2">
        {/* Description, DESKTOP position: the Genius/Wikipedia text
            runs horizontally across the whole page width instead of
            stacking tall in the narrow left column. */}
        <div className="hidden xl:block space-y-4">
          <Suspense fallback={<ShimmerLines lines={2} />}>
            <DescriptionBlock release={release} artistName={artistName} />
          </Suspense>
        </div>

        {/* Community Reviews — every take on this release in full,
            highest-rated first (getReleaseReviews sorts by rating,
            then recency), with a persistent "add yours" */}
        <div className="divider-glow" />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="glow-orb" />
              <span className="label-xbox">
                Community Reviews
                {reviews.length > 0 && ` (${reviews.length})`}
              </span>
            </div>
            {reviews.length > 0 && (
              <Link
                href={`/reviews/new?release_id=${release.id}`}
                className="pixel-text text-xs uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
              >
                + Add yours
              </Link>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="panel-xbox p-6 text-center space-y-3">
              <p className="font-[family-name:var(--font-vt323)] text-base text-text-muted">
                No reviews for this release yet.
              </p>
              <Link
                href={`/reviews/new?release_id=${release.id}`}
                className="btn-y2k btn-y2k-outline inline-block"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                Be the first to review this
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <ReleaseReviewEntry key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>

        {/* Followers */}
        {followers.length > 0 && (
          <>
            <div className="divider-glow" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">
                  {stats.follower_count}{" "}
                  {stats.follower_count === 1 ? "Follower" : "Followers"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {followers.map((f) => (
                  <Link
                    key={f.id}
                    href={`/profile/${f.username}`}
                    title={f.display_name ?? f.username}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 hover:scale-110 transition-transform"
                    style={{ borderColor: `${accentColor}40` }}
                  >
                    {f.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.avatar_url}
                        alt={f.display_name ?? f.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-sm font-bold"
                        style={{
                          background: `${accentColor}20`,
                          color: accentColor,
                        }}
                      >
                        {(f.display_name ?? f.username)[0]?.toUpperCase()}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      </div>

        {/* Scan bar */}
        <div className="scan-bar" />
    </div>
  );
}

/* ─────────────────────────  Rating histogram  ───────────────────────── */

/**
 * The community's spread of scores, Letterboxd-style: eleven bars
 * (0–10, each review rounded to the nearest whole number), colored
 * with the same rating colors used everywhere else on the site.
 * Pure server-rendered divs — no chart library.
 */
function RatingHistogram({ ratings }: { ratings: number[] }) {
  const bins = Array.from({ length: 11 }, () => 0);
  for (const r of ratings) {
    const bin = Math.min(10, Math.max(0, Math.round(r)));
    bins[bin]++;
  }
  const max = Math.max(...bins, 1);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-[3px] h-14">
        {bins.map((count, score) => (
          <div
            key={score}
            title={`${score}: ${count} ${count === 1 ? "review" : "reviews"}`}
            className="flex-1 rounded-t-sm"
            style={
              count === 0
                ? { height: "3px", background: "rgba(255,255,255,0.08)" }
                : {
                    height: `${Math.max(10, (count / max) * 100)}%`,
                    background: getRatingHex(score),
                    opacity: 0.9,
                  }
            }
          />
        ))}
      </div>
      <div className="flex justify-between">
        <span className="pixel-text text-[0.65rem] text-text-muted">0</span>
        <span className="pixel-text text-[0.65rem] text-text-muted uppercase tracking-widest">
          rating spread
        </span>
        <span className="pixel-text text-[0.65rem] text-text-muted">10</span>
      </div>
    </div>
  );
}

/* ─────────────────────────  Review entry  ───────────────────────── */

interface ReviewWithProfile {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  snippet: string | null;
  summary: string | null;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

/**
 * A full review, right on the release page — who wrote it front and
 * center, their words in full, not just a floating number. The rating
 * only makes sense next to the person behind it.
 */
function ReleaseReviewEntry({ review }: { review: ReviewWithProfile }) {
  const ratingColor = getRatingHex(review.rating);
  const profile = Array.isArray(review.profiles)
    ? review.profiles[0]
    : review.profiles;
  const reviewerName = profile?.display_name ?? profile?.username ?? "anonymous";
  const body = review.summary ?? review.snippet;

  let reviewedOn: string | null = null;
  try {
    reviewedOn = new Date(review.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    reviewedOn = null;
  }

  return (
    <article className="panel-xbox p-4 sm:p-5 space-y-3 relative overflow-hidden">
      {/* Reviewer header: avatar + name lead, rating rides along */}
      <div className="flex items-center gap-3">
        {profile?.username ? (
          <Link
            href={`/profile/${profile.username}`}
            className="flex items-center gap-3 min-w-0 group"
          >
            <ReviewerAvatar profile={profile} ratingColor={ratingColor} />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors truncate">
                {reviewerName}
              </span>
              <span className="block text-xs text-text-muted truncate">
                @{profile.username}
                {reviewedOn && ` · ${reviewedOn}`}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <ReviewerAvatar profile={profile} ratingColor={ratingColor} />
            <span className="text-sm font-bold text-text-primary">
              {reviewerName}
            </span>
          </div>
        )}

        <div
          className={`rating-badge text-sm w-11 h-11 shrink-0 ml-auto ${getRatingColor(review.rating)}`}
          style={{ color: ratingColor, borderColor: ratingColor }}
        >
          {formatRating(review.rating)}
        </div>
      </div>

      {/* The review itself, in full */}
      {body ? (
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
          {body}
        </p>
      ) : (
        <p className="text-sm text-text-muted italic">
          Rated, no words — the number speaks for itself.
        </p>
      )}

      {/* Likes + comments live on the review's own page */}
      <Link
        href={`/reviews/${review.slug}`}
        className="pixel-text text-xs uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors inline-flex items-center gap-1"
      >
        Likes + comments →
      </Link>
    </article>
  );
}

function ReviewerAvatar({
  profile,
  ratingColor,
}: {
  profile: ReviewWithProfile["profiles"];
  ratingColor: string;
}) {
  const name = profile?.display_name ?? profile?.username ?? "anonymous";
  return profile?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt={name}
      className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
    />
  ) : (
    <span
      className="w-10 h-10 rounded-full inline-flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: `${ratingColor}20`, color: ratingColor }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
