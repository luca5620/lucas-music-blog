import { getAllReviews, getReviewBySlug, getGenreColor, getRatingColor } from "@/lib/reviews";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

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
    title: `${review.title} by ${review.artist} — Peak Music Reviews`,
    description: review.snippet,
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/reviews"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Reviews
      </Link>

      {/* Main content card */}
      <div className="panel-xbox-glow p-6 md:p-8 space-y-6 relative">
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
          <h1 className="font-[family-name:var(--font-heading)] text-3xl md:text-4xl font-extrabold text-text-primary">
            {review.title}
          </h1>
          <p className="text-lg text-text-secondary mt-1">{review.artist}</p>
        </div>

        {/* Genre + Date */}
        <div className="flex items-center gap-3">
          <span
            className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}
          >
            {review.genre}
          </span>
          <span className="text-text-muted text-xs">
            {new Date(review.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Divider */}
        <div className="divider-glow" />

        {/* Review Summary */}
        <div className="space-y-4">
          <p className="text-text-secondary leading-relaxed text-sm md:text-base">
            {review.summary}
          </p>
        </div>

        {/* Standout Tracks */}
        {review.standoutTracks.length > 0 && (
          <>
            <div className="divider-glow" />

            <div className="card-y2k p-5 space-y-3">
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
                    className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="pixel-text text-sm text-text-muted">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-text-primary">
                        {track.title}
                      </span>
                    </div>
                    <span className="text-xs text-accent-primary hover:text-accent-glow transition-colors">
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
    </div>
  );
}
