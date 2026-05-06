import { getAllReviews, getReviewBySlug, getGenreColor, getRatingColor } from "@/lib/reviews";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema, ReviewSchema } from "@/app/schema";
import { createClient } from "@/lib/supabase/server";
import CommentsSection from "@/components/reviews/CommentsSection";
import LikeButton from "@/components/reviews/LikeButton";

export function generateStaticParams() {
  return getAllReviews().map((review) => ({ slug: review.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "Review Not Found" };

  return {
    title: `${review.title} by ${review.artist}`,
    description: review.snippet,
    keywords: [
      review.genre,
      review.artist,
      review.title,
      review.releaseType,
      "music review",
      "album review",
    ],
    openGraph: {
      type: "music.album",
      url: `https://peakmusicreviews.com/reviews/${slug}`,
      title: `${review.title} by ${review.artist} — Peak Music Reviews`,
      description: review.snippet,
      ...(review.coverImage && {
        images: [
          {
            url: review.coverImage,
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
      description: review.snippet,
      ...(review.coverImage && { images: [review.coverImage] }),
    },
    alternates: {
      canonical: `https://peakmusicreviews.com/reviews/${slug}`,
    },
    other: {
      ...(review.reviewDate && { "article:published_time": review.reviewDate }),
      "music:release_date": review.releaseDate,
    },
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);

  if (!review) notFound();

  // Look up the review's database ID from Supabase for comments + likes
  let reviewDbId: string | null = null;
  let likeCount = 0;
  let viewerHasLiked = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reviews")
      .select("id")
      .eq("slug", slug)
      .single();
    reviewDbId = (data as { id: string } | null)?.id ?? null;

    if (reviewDbId) {
      const [{ count }, { data: { user } }] = await Promise.all([
        supabase
          .from("review_likes")
          .select("id", { count: "exact", head: true })
          .eq("review_id", reviewDbId),
        supabase.auth.getUser(),
      ]);
      likeCount = count ?? 0;

      if (user) {
        const { data: liked } = await supabase
          .from("review_likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("review_id", reviewDbId)
          .maybeSingle();
        viewerHasLiked = !!liked;
      }
    }
  } catch {
    // Supabase may not be configured; comments + likes won't render
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Reviews", href: "/reviews" },
          { name: `${review.title} by ${review.artist}`, href: `/reviews/${review.slug}` },
        ]}
      />
      <ReviewSchema review={review} />

      {/* Back link */}
      <Link
        href="/reviews"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Reviews
      </Link>

      {/* Main content card */}
      <div className="panel-xbox-glow p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 relative overflow-hidden">
        {/* Cover Image */}
        <div className="aspect-square max-w-sm mx-auto rounded-lg bg-bg-elevated flex items-center justify-center overflow-hidden border border-[rgba(30,144,255,0.15)]">
          {review.coverImage ? (
            <img
              src={review.coverImage}
              alt={`${review.title} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">💿</span>
          )}
        </div>

        {/* Release type + Rating */}
        <div className="flex items-center justify-between">
          <span className="label-xbox text-[0.6rem]">
            {review.releaseType}
          </span>
          <div
            className={`rating-badge text-2xl ${getRatingColor(review.rating)}`}
          >
            {review.rating}
          </div>
        </div>

        {/* Title + Artist */}
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl md:text-4xl font-extrabold text-text-primary break-words">
            {review.title}
          </h1>
          <p className="text-lg text-text-secondary mt-1">{review.artist}</p>
        </div>

        {/* Like button */}
        {reviewDbId && (
          <div className="flex items-center gap-3">
            <LikeButton
              reviewId={reviewDbId}
              initialCount={likeCount}
              initialLiked={viewerHasLiked}
              size="md"
            />
            <span className="label-xbox text-[0.6rem]">Likes</span>
          </div>
        )}

        {/* Genre + Dates */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}
          >
            {review.genre}
          </span>
          <span className="text-text-muted text-xs">
            Released{" "}
            {new Date(review.releaseDate + "T12:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {review.reviewDate ? (
            <span className="text-text-muted text-xs">
              Reviewed{" "}
              {new Date(review.reviewDate + "T12:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : (
            <span className="text-text-muted text-xs italic">Review pending</span>
          )}
        </div>

        {/* Divider */}
        <div className="divider-glow" />

        {/* Review Summary */}
        <div className="space-y-4">
          {review.summary ? (
            <p className="text-text-secondary leading-relaxed text-sm md:text-base">
              {review.summary}
            </p>
          ) : (
            <p className="text-text-muted leading-relaxed text-sm md:text-base italic">
              Full review coming soon. Check back later.
            </p>
          )}
        </div>

        {/* Standout Tracks */}
        {review.standoutTracks.length > 0 && (
          <>
            <div className="divider-glow" />

            <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">Standout Tracks</span>
              </div>

              <div className="space-y-2">
                {review.standoutTracks.map((track, i) => (
                  <a
                    key={track.title}
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 py-2 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="pixel-text text-sm text-text-muted shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {track.title}
                      </span>
                    </div>
                    <span className="text-xs text-accent-primary hover:text-accent-glow transition-colors shrink-0 whitespace-nowrap">
                      Spotify ↗
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Scan bar */}
        <div className="scan-bar" />
      </div>

      {/* Comments Section */}
      {reviewDbId && <CommentsSection reviewId={reviewDbId} />}
    </div>
  );
}
