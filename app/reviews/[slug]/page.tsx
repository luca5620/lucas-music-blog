/**
 * Review detail page — Overhaul v2, fully DB-driven.
 * One review by one member about one real catalog release. Shows the
 * reviewer's identity (with verified badge), links back to the
 * canonical release page, and keeps likes + comments.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getReviewWithContextBySlug } from "@/lib/db/reviews";
import { getRatingColor, getGenreColor, formatRating } from "@/lib/rating";
import { BreadcrumbSchema, ReviewSchema } from "@/app/schema";
import { createClient } from "@/lib/supabase/server";
import CommentsSection from "@/components/reviews/CommentsSection";
import LikeButton from "@/components/reviews/LikeButton";
import ReportButton from "@/components/moderation/ReportButton";
import { VerifiedBadge } from "@/components/ui/RoleBadge";

// Community content changes constantly — always render fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const review = await getReviewWithContextBySlug(slug);
  if (!review) return { title: "Review Not Found" };

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
  if (!review) notFound();

  const author = review.profiles;
  const release = review.releases;
  const isVerified = author.role !== "user";

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

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
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

      {/* Back link */}
      <Link
        href="/reviews"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Reviews
      </Link>

      {/* Draft banner (only the owner ever sees a draft) */}
      {!review.is_published && (
        <div className="panel-xbox p-3 border-yellow-500/30 bg-yellow-500/5">
          <p className="pixel-text text-sm text-yellow-400">
            DRAFT — only you can see this. Publish it from the edit page.
          </p>
        </div>
      )}

      {/* Main content card */}
      <div className="panel-xbox-glow p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 relative overflow-hidden">
        {/* Cover from the catalog */}
        <div className="aspect-square max-w-sm mx-auto rounded-lg bg-bg-elevated flex items-center justify-center overflow-hidden border border-[rgba(var(--accent-rgb),0.15)] relative">
          {review.cover_image ? (
            <img
              src={review.cover_image}
              alt={`${review.title} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">💿</span>
          )}
          {release?.is_unreleased && (
            <span className="poster-unreleased">Unreleased</span>
          )}
        </div>

        {/* Release type + Rating */}
        <div className="flex items-center justify-between">
          <span className="label-xbox text-[0.6rem]">
            {(review.release_type ?? "RELEASE").toUpperCase()}
          </span>
          <div className={`rating-badge text-2xl ${getRatingColor(review.rating)}`}>
            {formatRating(review.rating)}
          </div>
        </div>

        {/* Title + Artist */}
        <div>
          <h1 className="crt-title text-2xl sm:text-3xl md:text-4xl break-words">
            {review.title}
          </h1>
          <p className="text-lg text-text-secondary mt-1">{review.artist}</p>
        </div>

        {/* Reviewer identity */}
        <Link
          href={`/profile/${author.username}`}
          className="inline-flex items-center gap-2.5 group"
        >
          {author.avatar_url ? (
            <img
              src={author.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-white/10"
            />
          ) : (
            <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
              {(author.username || "U")[0]}
            </span>
          )}
          <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors flex items-center gap-1.5">
            review by{" "}
            <span className="font-bold text-text-primary">
              {author.display_name || author.username}
            </span>
            {isVerified && <VerifiedBadge role={author.role} />}
          </span>
        </Link>

        {/* Like + report */}
        <div className="flex items-center gap-3">
          <LikeButton
            reviewId={review.id}
            initialCount={likeCount}
            initialLiked={viewerHasLiked}
            size="md"
          />
          <span className="label-xbox text-[0.6rem]">Likes</span>
          <ReportButton targetType="review" targetId={review.id} />
        </div>

        {/* Genre + Dates */}
        <div className="flex flex-wrap items-center gap-3">
          {review.genre && (
            <span
              className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}
            >
              {review.genre}
            </span>
          )}
          {review.release_date && (
            <span className="text-text-muted text-xs">
              Released{" "}
              {new Date(review.release_date + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </span>
          )}
          {review.review_date && (
            <span className="text-text-muted text-xs">
              Reviewed{" "}
              {new Date(review.review_date + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </span>
          )}
        </div>

        {/* Link to the canonical release page */}
        {release && (
          <Link
            href={`/releases/${release.slug}`}
            className="inline-flex items-center gap-2 text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest pixel-text"
          >
            View release page + all reviews →
          </Link>
        )}

        {/* Divider */}
        <div className="divider-glow" />

        {/* Review body */}
        <div className="space-y-4">
          {review.summary ? (
            <p className="text-text-secondary leading-relaxed text-sm md:text-base whitespace-pre-line">
              {review.summary}
            </p>
          ) : review.snippet ? (
            <p className="text-text-secondary leading-relaxed text-sm md:text-base">
              {review.snippet}
            </p>
          ) : (
            <p className="text-text-muted leading-relaxed text-sm md:text-base italic">
              Rated, no words — the number speaks for itself.
            </p>
          )}
        </div>

        {/* Standout Tracks */}
        {review.standout_tracks.length > 0 && (
          <>
            <div className="divider-glow" />

            <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">Standout Tracks</span>
              </div>

              <div className="space-y-2">
                {review.standout_tracks.map((track, i) => {
                  const inner = (
                    <div className="flex items-center justify-between gap-2 py-2 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 rounded-lg px-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="pixel-text text-sm text-text-muted shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-text-primary truncate">
                          {track.title}
                        </span>
                      </div>
                      {track.spotifyUrl && (
                        <span className="text-xs text-accent-primary shrink-0 whitespace-nowrap">
                          Spotify ↗
                        </span>
                      )}
                    </div>
                  );
                  return track.spotifyUrl ? (
                    <a
                      key={`${track.title}-${i}`}
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={`${track.title}-${i}`}>{inner}</div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Scan bar */}
        <div className="scan-bar" />
      </div>

      {/* Comments Section */}
      <CommentsSection reviewId={review.id} />
    </div>
  );
}
