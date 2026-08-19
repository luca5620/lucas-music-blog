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
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getReleaseBySlug,
  getReleaseStats,
  getReleaseReviews,
  getReleaseFollowers,
  isFollowingRelease,
} from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import { getOrCreateRoom, getRoomMessages } from "@/lib/db/rooms";
import { getUser } from "@/lib/auth";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import FollowEntityButton from "@/components/follow/FollowEntityButton";
import ChatPanel, {
  type ChatMessageWithProfile,
} from "@/components/rooms/ChatPanel";
import { BreadcrumbSchema } from "@/app/schema";
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

/* ─────────────────────────  Metadata  ───────────────────────── */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) return { title: "Release Not Found" };

  const artist = await getArtistById(release.primary_artist_id);
  const artistName = artist?.name ?? "Unknown Artist";
  const description =
    release.description ??
    `${release.title} by ${artistName} — listen, follow, and read reviews on Peak Music Reviews.`;

  return {
    title: `${release.title} by ${artistName}`,
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
  const initialMessages = room
    ? ((await getRoomMessages(room.id, {
        limit: 30,
      })) as ChatMessageWithProfile[])
    : ([] as ChatMessageWithProfile[]);

  const accentColor =
    stats.avg_rating !== null ? getRatingHex(stats.avg_rating) : "#1e90ff";

  const tracks = (release.tracks ?? []) as ReleaseTrack[];

  const releaseDateFormatted = formatDate(release.release_date);
  const artistName = artist?.name ?? "Unknown Artist";
  const artistSlug = artist?.slug;

  return (
    <div
      className="space-y-6 max-w-3xl mx-auto overflow-hidden"
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

      {/* Back link */}
      <Link
        href="/releases"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Releases
      </Link>

      <ReleaseContent
        release={release}
        stats={stats}
        isFollowing={isFollowing}
        accentColor={accentColor}
        tracks={tracks}
        room={room}
        initialMessages={initialMessages}
        reviews={reviews}
        followers={followers}
        releaseDateFormatted={releaseDateFormatted}
        artistName={artistName}
        artistSlug={artistSlug}
      />
    </div>
  );
}

/* ─────────────────────────  Release content (extracted for ReactionsLayer wrap)  ───────────────────────── */

interface ReleaseContentProps {
  release: Release;
  stats: ReleaseStats;
  isFollowing: boolean;
  accentColor: string;
  tracks: ReleaseTrack[];
  room: ReleaseRoom | null;
  initialMessages: ChatMessageWithProfile[];
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
  reviews,
  followers,
  releaseDateFormatted,
  artistName,
  artistSlug,
}: ReleaseContentProps) {
  return (
    <div className="panel-xbox-glow p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 relative overflow-hidden">
        {/* Cover Image */}
        <div
          className="aspect-square max-w-md mx-auto rounded-lg bg-bg-elevated flex items-center justify-center overflow-hidden border-2"
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
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-5xl font-extrabold text-text-primary break-words">
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
            <span className="text-text-muted text-xs">
              Released {releaseDateFormatted}
            </span>
          )}
        </div>

        {/* Stats row: rating + reviews + followers */}
        <div className="flex flex-wrap items-center gap-4">
          {stats.avg_rating !== null ? (
            <div className="flex items-center gap-2">
              <div
                className={`rating-badge text-2xl ${getRatingColor(stats.avg_rating)}`}
              >
                {formatRating(stats.avg_rating)}
              </div>
              <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                Avg rating
              </span>
            </div>
          ) : (
            <span className="text-xs text-text-muted italic">No reviews yet</span>
          )}

          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {stats.review_count}{" "}
            {stats.review_count === 1 ? "review" : "reviews"}
          </span>
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {stats.follower_count}{" "}
            {stats.follower_count === 1 ? "follower" : "followers"}
          </span>
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

        {/* Description */}
        {release.description && (
          <>
            <div className="divider-glow" />
            <p className="text-text-secondary leading-relaxed text-sm md:text-base">
              {release.description}
            </p>
          </>
        )}

        {/* Tracks */}
        {tracks.length > 0 && (
          <>
            <div className="divider-glow" />
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

        {/* Live Room */}
        {room && (
          <>
            <div className="divider-glow" />
            <ChatPanel
              releaseId={release.id}
              initialMessages={initialMessages}
              initialRoom={room}
              accentColor={accentColor}
            />
          </>
        )}

        {/* Top Reviews — highest-rated first (getReleaseReviews sorts
            by rating, then recency), with a persistent "add yours" */}
        <div className="divider-glow" />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="glow-orb" />
              <span className="label-xbox">Top Reviews</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reviews.map((r) => (
                <ReleaseReviewCard key={r.id} review={r} />
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

        {/* Scan bar */}
        <div className="scan-bar" />
    </div>
  );
}

/* ─────────────────────────  Review card  ───────────────────────── */

interface ReviewWithProfile {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  snippet: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

function ReleaseReviewCard({ review }: { review: ReviewWithProfile }) {
  const ratingColor = getRatingHex(review.rating);
  const profile = Array.isArray(review.profiles)
    ? review.profiles[0]
    : review.profiles;
  const reviewerName = profile?.display_name ?? profile?.username ?? "anonymous";

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="panel-xbox p-3 sm:p-4 space-y-3 group cursor-pointer hover-glow relative overflow-hidden block"
    >
      <div className="flex items-start gap-3">
        <div className="aspect-square w-16 h-16 sm:w-20 sm:h-20 rounded-md bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden shrink-0">
          {review.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.cover_image}
              alt={review.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <span className="text-2xl text-text-muted">{"//"}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-[family-name:var(--font-heading)] text-sm sm:text-base font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors line-clamp-2">
              {review.title}
            </h3>
            <div
              className={`rating-badge text-xs w-9 h-9 shrink-0 ${getRatingColor(review.rating)}`}
              style={{ color: ratingColor, borderColor: ratingColor }}
            >
              {formatRating(review.rating)}
            </div>
          </div>
          <p className="text-xs text-text-muted truncate">by {reviewerName}</p>
          {review.snippet && (
            <p className="text-xs text-text-secondary line-clamp-2">
              {review.snippet}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
